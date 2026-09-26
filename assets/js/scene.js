/* ============================================================================
   SP Automatizaciones — Motor 3D (WebGL / Three.js)
   Una escena distinta por página, declarada con   <div class="stage-canvas"
   data-scene="core|grid|orbit|globe|tunnel">

   Orden de carga pensado para que el 3D nunca retrase el contenido:
     1. Este módulo es diminuto y no importa Three.js de forma estática.
     2. Espera a que la página cargue y el navegador quede libre.
     3. Solo entonces descarga Three.js (alojado en el propio sitio).
     4. Compila los shaders en segundo plano (compileAsync) y aparece con
        un fundido, sin bloquear el hilo principal.
   Degradación: sin WebGL, con fallo de carga, con pérdida de contexto o con
   prefers-reduced-motion → fondo CSS animado (clase .fallback).
   ========================================================================== */

const host = document.querySelector('[data-scene]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Marca síncrona: le dice a la red de seguridad del HTML que este módulo
// sí se ejecutó, para que no active el respaldo mientras el 3D carga.
if (host) host.dataset.state = 'loading';

function bail(err) {
  if (err) console.warn('[3D] desactivado, se usa el fondo CSS:', err);
  if (host) { host.classList.add('fallback'); host.dataset.state = 'off'; }
}

/* Calidad según el dispositivo. Teléfonos y tablets: menos píxeles y menos
   partículas; la diferencia visual es mínima y el ahorro de batería y GPU,
   grande. */
const lite = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const Q = {
  lite,
  dpr: Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2),
  particles: lite ? 0.55 : 1
};
const cuenta = (n) => Math.round(n * Q.particles);

// Cede el hilo principal entre fases: varias tareas cortas en lugar de una
// larga que congele el scroll o los toques.
const pausa = () => new Promise((r) => setTimeout(r, 0));

// ?3d=1 en la URL fuerza el 3D aunque no haya GPU (útil para pruebas).
const forzar = /[?&]3d=1\b/.test(location.search);

/* Sonda de GPU en un Web Worker (OffscreenCanvas): averiguar si hay GPU
   exige crear un contexto WebGL, y sin GPU eso cuesta ~650 ms. Hecho en el
   hilo principal congelaba la página justo en los equipos más lentos; en un
   worker no bloquea nada.
   Responde true (hay GPU), false (render por software) o null (el navegador
   no permite WebGL en workers: se decide en el hilo principal). */
const SONDA = `onmessage = () => {
  if (typeof WebGL2RenderingContext === 'undefined') { postMessage(null); return; }
  let r = false;
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
      r = !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    }
  } catch (e) { r = null; }
  postMessage(r);
};`;

function sondearGPU() {
  return new Promise((resolve) => {
    if (forzar || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return resolve(null);
    let w, url;
    const fin = (v) => { clearTimeout(t); try { w.terminate(); URL.revokeObjectURL(url); } catch (e) {} resolve(v); };
    const t = setTimeout(() => fin(null), 5000);
    try {
      url = URL.createObjectURL(new Blob([SONDA], { type: 'text/javascript' }));
      w = new Worker(url);
    } catch (e) { return fin(null); }
    w.onmessage = (e) => fin(e.data);
    w.onerror = () => fin(null);
    w.postMessage(0);
  });
}

/* Pide el contexto WebGL con failIfMajorPerformanceCaveat: el navegador lo
   niega si tendría que dibujar por software (sin GPU, o con la GPU en lista
   negra). En ese caso el 3D iría a trompicones y quemaría CPU, así que se usa
   el fondo CSS y ni siquiera se descarga Three.js.
   Se reutiliza el mismo contexto para Three.js: no se crea dos veces. */
function crearContexto(canvas) {
  const attrs = {
    alpha: true, antialias: true, depth: true, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false,
    powerPreference: Q.lite ? 'default' : 'high-performance',
    failIfMajorPerformanceCaveat: !forzar
  };
  const gl = canvas.getContext('webgl2', attrs);
  if (!gl) return null;
  if (!forzar) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return null;
    }
  }
  return gl;
}

let THREE, ACC, ACC2, ACC3;

/* --- sprite circular suave, generado en canvas (sin peticiones externas) --- */
function dotTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.35, 'rgba(255,255,255,.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/* Encuadre: en pantallas verticales el ancho visible se desploma, así que se
   abre el campo de visión (hasta 70°) y, si no basta, se aleja la cámara. */
const BASE_Z = 26, BASE_FOV = 52, MAX_FOV = 70, MEDIO_ANCHO = 10.5;
function encuadrar(camera, aspect) {
  const necesario = MEDIO_ANCHO / aspect;
  const fovIdeal = 2 * Math.atan(necesario / BASE_Z) * 180 / Math.PI;
  const fov = Math.min(MAX_FOV, Math.max(BASE_FOV, fovIdeal));
  const z = Math.max(BASE_Z, necesario / Math.tan(fov * Math.PI / 360));
  camera.fov = fov;
  camera.aspect = aspect;
  camera.position.z = z;
  camera.updateProjectionMatrix();
}

async function boot(mount, kind) {
  if (await sondearGPU() === false) return bail();   // sin GPU: ni se intenta
  const canvas = document.createElement('canvas');
  const gl = crearContexto(canvas);
  if (!gl) return bail();              // sin GPU: fondo CSS, sin descargar nada
  await pausa();

  THREE = await import('three');
  ACC  = new THREE.Color('#c4f82a');   // lima del logotipo
  ACC2 = new THREE.Color('#6e5bff');   // violeta de profundidad
  ACC3 = new THREE.Color('#e9ff9c');   // lima pálido
  await pausa();   // evaluar Three.js y crear el contexto WebGL: tareas separadas

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.setPixelRatio(Q.dpr);
  // Las comprobaciones de errores de shader son consultas síncronas a la GPU;
  // los shaders son los de Three.js, ya probados.
  renderer.debug.checkShaderErrors = false;
  await pausa();

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 200);
  camera.position.set(0, 0, BASE_Z);

  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.AmbientLight(0xffffff, .5));
  const key = new THREE.PointLight(ACC, 220, 90);  key.position.set(14, 12, 18);  scene.add(key);
  const rim = new THREE.PointLight(ACC2, 180, 90); rim.position.set(-16, -8, 10);  scene.add(rim);

  const sprite = dotTexture();
  const build = SCENES[kind] || SCENES.core;
  const tick  = build(world, { sprite, camera });

  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    encuadrar(camera, w / h);
  }
  resize();
  await pausa();

  /* Enlazar shaders es lo más caro del arranque: antes congelaba la página
     ~1,5 s en el primer fotograma. Si el navegador compila en paralelo, se
     espera sin bloquear; si no (p. ej. algunos Safari), se enlaza un tipo de
     material por tarea, con el canvas todavía invisible. */
  if (renderer.extensions.has('KHR_parallel_shader_compile')) {
    await renderer.compileAsync(scene, camera);
  } else {
    const hijos = world.children.slice(), vistos = new Set();
    for (const o of hijos) {
      const m = o.material;
      if (!m) continue;
      const tipo = m.type + (m.vertexColors ? ':v' : '') + (m.map ? ':m' : '') + (m.flatShading ? ':f' : '');
      if (vistos.has(tipo)) continue;
      vistos.add(tipo);
      hijos.forEach((h) => { h.visible = h === o; });
      renderer.render(scene, camera);
      await pausa();
    }
    hijos.forEach((h) => { h.visible = true; });
  }

  mount.appendChild(canvas);
  mount.classList.remove('fallback');

  /* ---- interacción ---- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollN = 0, ultimoPuntero = -1e9;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;       // en táctil manda el vaivén
    ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
    ultimoPuntero = performance.now();
  }, { passive: true });

  const onScroll = () => {
    const r = mount.getBoundingClientRect();
    scrollN = -r.top / Math.max(r.height, 1);   // 0 arriba → 1 fuera de pantalla
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  new ResizeObserver(resize).observe(mount);

  /* ---- loop: se detiene fuera de pantalla, con la pestaña oculta o si el
          sistema retira el contexto WebGL (frecuente en móviles) ---- */
  const clock = new THREE.Clock();
  let visible = true, running = false, raf = 0, perdido = false;

  /* Vigilante de fluidez: en teléfonos con GPU modesta, si el 3D va lento se
     baja la resolución; si aun así no llega, se cede al fondo CSS. */
  let nivel = 0, muestras = 0, acumulado = 0, previo = 0, ignorar = 30;
  function vigilar(ahora) {
    if (forzar || nivel > 1) return;
    if (ignorar > 0) { ignorar--; previo = ahora; return; }   // arranque: no cuenta
    if (previo) { acumulado += ahora - previo; muestras++; }
    previo = ahora;
    if (muestras < 90) return;
    const ms = acumulado / muestras;
    muestras = 0; acumulado = 0;
    if (ms <= 34) { nivel = 2; return; }        // ≥ ~30 fps: se queda así
    if (nivel === 0 && Q.dpr > 1) {             // 1.er aviso: menos píxeles
      nivel = 1; renderer.setPixelRatio(1); resize(); return;
    }
    nivel = 2; stop();                          // 2.º aviso: fondo CSS
    mount.classList.remove('is-live'); mount.classList.add('fallback');
    mount.dataset.state = 'off';
  }

  function frame() {
    if (!running) return;
    if (!visible || document.hidden || perdido) { running = false; return; }
    raf = requestAnimationFrame(frame);
    vigilar(performance.now());
    const t = clock.getElapsedTime();

    // Sin ratón (móvil, tablet o ratón quieto) la cámara se mece sola.
    if (performance.now() - ultimoPuntero > 4000) {
      ptr.tx = Math.sin(t * .23) * .55;
      ptr.ty = Math.cos(t * .19) * .3;
    }
    ptr.x += (ptr.tx - ptr.x) * .045;
    ptr.y += (ptr.ty - ptr.y) * .045;

    tick(t, ptr, scrollN);

    camera.position.x += (ptr.x * 3.2 - camera.position.x) * .04;
    camera.position.y += (-ptr.y * 2.2 - camera.position.y) * .04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  function start() {
    if (running || !visible || document.hidden || perdido || mount.dataset.state === 'off') return;
    running = true; previo = 0; clock.getDelta(); frame();
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); },
    { threshold: 0 }).observe(mount);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); perdido = true; stop();
    mount.classList.add('fallback'); mount.classList.remove('is-live');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    perdido = false;
    if (mount.dataset.state === 'off') return;   // ya se había cedido al fondo CSS
    mount.classList.remove('fallback'); mount.classList.add('is-live'); start();
  });

  start();
  requestAnimationFrame(() => {
    mount.classList.add('is-live');     // fundido de entrada (CSS)
    mount.dataset.state = 'live';
  });
}

/* ==========================================================================
   ESCENAS
   ========================================================================== */
const SCENES = {

  /* --- HOME: núcleo poliédrico + nube de partículas + anillos orbitales --- */
  core(world, { sprite }) {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(6.2, 1),
      new THREE.MeshBasicMaterial({ color: ACC, wireframe: true, transparent: true, opacity: .32 })
    );
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(8.6, 0),
      new THREE.MeshBasicMaterial({ color: ACC2, wireframe: true, transparent: true, opacity: .18 })
    );
    const solid = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.2, 0),
      new THREE.MeshPhongMaterial({
        color: '#0b1a18', specular: '#5c6b3a', shininess: 70,
        emissive: ACC, emissiveIntensity: .12, flatShading: true
      })
    );
    world.add(core, shell, solid);

    // nube de partículas esférica
    const N = cuenta(2600), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 11 + Math.random() * 13;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.sin(ph) * Math.sin(th) * .72;
      pos[i*3+2] = r * Math.cos(ph);
      const c = Math.random() < .55 ? ACC : (Math.random() < .5 ? ACC2 : ACC3);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    const cloud = new THREE.Points(
      new THREE.BufferGeometry()
        .setAttribute('position', new THREE.BufferAttribute(pos, 3))
        .setAttribute('color',    new THREE.BufferAttribute(col, 3)),
      new THREE.PointsMaterial({
        size: .17, map: sprite, vertexColors: true, transparent: true, opacity: .85,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
      })
    );
    world.add(cloud);

    // anillos orbitales
    const rings = [];
    [[9.4, ACC, .5], [11.6, ACC2, .35], [13.8, ACC3, .22]].forEach(([r, c, o], i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, .022, 8, 160),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o })
      );
      ring.rotation.x = Math.PI / 2 - .38 - i * .16;
      ring.rotation.z = i * .5;
      rings.push(ring); world.add(ring);
    });

    return (t, ptr, s) => {
      core.rotation.y  = t * .12 + ptr.x * .3;
      core.rotation.x  = t * .07 - ptr.y * .22;
      shell.rotation.y = -t * .08;
      shell.rotation.z = t * .05;
      solid.rotation.y = -t * .22;
      solid.rotation.x = t * .16;
      cloud.rotation.y = t * .035 + ptr.x * .12;
      rings.forEach((r, i) => { r.rotation.z += .0022 * (i % 2 ? -1 : 1); });
      world.position.y = s * 9;
      world.scale.setScalar(1 - Math.min(s, 1) * .18);
    };
  },

  /* --- SERVICIOS: malla de onda (flujo de datos / pipelines) --- */
  grid(world, { sprite }) {
    /* Terreno de datos visto desde arriba. Antes el plano miraba de frente a
       la cámara y la onda se movía hacia el espectador: no se percibía. */
    const SIZE = 46, STEP = Q.lite ? 1.25 : .95, TILT = .42;
    const pts = [];
    for (let x = -SIZE / 2; x < SIZE / 2; x += STEP)
      for (let z = -SIZE / 2; z < SIZE / 2; z += STEP) pts.push(x, 0, z);
    const N = pts.length / 3;

    const geo = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3))
      .setAttribute('color',    new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const base = Float32Array.from(pts);

    const mesh = new THREE.Points(geo, new THREE.PointsMaterial({
      size: Q.lite ? .3 : .24, map: sprite, vertexColors: true, transparent: true,
      opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    mesh.rotation.x = TILT;
    mesh.position.y = -6;
    world.add(mesh);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(9, .035, 8, 140),
      new THREE.MeshBasicMaterial({ color: ACC2, transparent: true, opacity: .55 })
    );
    halo.rotation.x = -(Math.PI / 2 - TILT);
    halo.position.y = 3.2;
    world.add(halo);

    // Valles en violeta tenue, crestas en lima: la onda se lee por color.
    const bajo = ACC2.clone().multiplyScalar(.6);
    const arr = geo.attributes.position.array, col = geo.attributes.color.array;
    return (t, ptr, s) => {
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], z = base[i + 2];
        const y = Math.sin(x * .22 + t * 1.1) * 1.5
                + Math.cos(z * .18 - t * .8) * 1.2
                + Math.sin((x + z) * .1 + t * .5) * .9;
        arr[i + 1] = y;
        let k = (y + 1.2) / 3.6; k = k < 0 ? 0 : k > 1 ? 1 : k;
        col[i]     = bajo.r + (ACC.r - bajo.r) * k;
        col[i + 1] = bajo.g + (ACC.g - bajo.g) * k;
        col[i + 2] = bajo.b + (ACC.b - bajo.b) * k;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      mesh.rotation.y = ptr.x * .15;
      halo.rotation.z = t * .3;
      halo.scale.setScalar(1 + Math.sin(t * .8) * .06);
      world.position.y = s * 8;
    };
  },

  /* --- CASOS: sistema de órbitas con satélites (proyectos en producción) --- */
  orbit(world, { sprite }) {
    const sun = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.6, 1),
      new THREE.MeshPhongMaterial({
        color: '#08120f', specular: '#5c6b3a', shininess: 70,
        emissive: ACC, emissiveIntensity: .25, flatShading: true
      })
    );
    world.add(sun);

    const sats = [];
    [[7.5, ACC, .9, 1.0], [11, ACC3, .62, -.62], [14.5, ACC2, .45, .38]].forEach(([r, c, spd, dir], i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, .018, 8, 180),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .32 })
      );
      ring.rotation.x = Math.PI / 2 - .5 + i * .18;
      world.add(ring);

      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(.34 - i * .05, 18, 18),
        new THREE.MeshBasicMaterial({ color: c })
      );
      world.add(orb);
      sats.push({ ring, orb, r, spd, dir, tilt: Math.PI / 2 - .5 + i * .18 });
    });

    const N = cuenta(1400), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 16 + Math.random() * 12, a = Math.random() * Math.PI * 2;
      pos[i*3] = Math.cos(a) * r; pos[i*3+1] = (Math.random() - .5) * 14; pos[i*3+2] = Math.sin(a) * r;
    }
    const dust = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ size: .13, map: sprite, color: ACC3, transparent: true,
        opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    world.add(dust);

    return (t, ptr, s) => {
      sun.rotation.y = t * .3; sun.rotation.x = t * .18;
      sats.forEach(({ orb, r, spd, dir, tilt }) => {
        const a = t * spd * dir;
        orb.position.set(Math.cos(a) * r, Math.sin(a) * r * Math.cos(tilt), Math.sin(a) * r * Math.sin(tilt));
      });
      dust.rotation.y = t * .04;
      world.rotation.y = ptr.x * .25;
      world.rotation.x = -ptr.y * .16;
      world.position.y = s * 8;
    };
  },

  /* --- NOSOTROS: globo alámbrico (Colombia / alcance) --- */
  globe(world, { sprite }) {
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(7.4, 34, 24),
      new THREE.MeshBasicMaterial({ color: ACC, wireframe: true, transparent: true, opacity: .2 })
    );
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(7.1, 40, 28),
      // Casi negra y sin facetas: el protagonismo es de la malla y los nodos.
      new THREE.MeshPhongMaterial({
        color: '#020403', specular: '#2a3318', shininess: 30,
        emissive: ACC2, emissiveIntensity: .05
      })
    );
    world.add(globe, inner);

    const N = cuenta(1100), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 7.5 + Math.random() * .5;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.cos(ph);
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
      const c = Math.random() < .7 ? ACC : ACC3;
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    const nodes = new THREE.Points(
      new THREE.BufferGeometry()
        .setAttribute('position', new THREE.BufferAttribute(pos, 3))
        .setAttribute('color', new THREE.BufferAttribute(col, 3)),
      new THREE.PointsMaterial({ size: .2, map: sprite, vertexColors: true, transparent: true,
        opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    world.add(nodes);

    const arcs = [];
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(7.6 + i * .12, .015, 6, 120, Math.PI * (.5 + Math.random() * .6)),
        new THREE.MeshBasicMaterial({ color: i % 2 ? ACC2 : ACC3, transparent: true, opacity: .55 })
      );
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      arcs.push(ring); world.add(ring);
    }

    return (t, ptr, s) => {
      globe.rotation.y = t * .09;
      inner.rotation.y = t * .09;
      nodes.rotation.y = t * .09;
      arcs.forEach((a, i) => { a.rotation.z += .0016 * (i % 2 ? 1 : -1); a.rotation.x += .0009; });
      world.rotation.x = -ptr.y * .2;
      world.rotation.z = ptr.x * .08;
      world.position.y = s * 8;
    };
  },

  /* --- CONTACTO: túnel de partículas (canal abierto) --- */
  tunnel(world, { sprite }) {
    const N = cuenta(2200), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const seed = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 9;
      const z = -70 + Math.random() * 90;
      seed.push({ a, r });
      pos[i*3] = Math.cos(a) * r; pos[i*3+1] = Math.sin(a) * r; pos[i*3+2] = z;
      const c = Math.random() < .6 ? ACC : (Math.random() < .5 ? ACC3 : ACC2);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    const geo = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(pos, 3))
      .setAttribute('color',    new THREE.BufferAttribute(col, 3));
    const flow = new THREE.Points(geo, new THREE.PointsMaterial({
      size: Q.lite ? .3 : .26, map: sprite, vertexColors: true, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    world.add(flow);

    const gates = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Mesh(
        new THREE.TorusGeometry(6.5, .02, 6, 100),
        new THREE.MeshBasicMaterial({ color: i % 2 ? ACC : ACC2, transparent: true, opacity: .45 })
      );
      g.position.z = -i * 11;
      gates.push(g); world.add(g);
    }

    const arr = geo.attributes.position.array;
    return (t, ptr, s) => {
      for (let i = 0; i < N; i++) {
        let z = arr[i*3+2] + .28;
        if (z > 22) z = -70;
        arr[i*3+2] = z;
        const a = seed[i].a + t * .08;
        arr[i*3]   = Math.cos(a) * seed[i].r;
        arr[i*3+1] = Math.sin(a) * seed[i].r;
      }
      geo.attributes.position.needsUpdate = true;
      gates.forEach((g, i) => {
        g.position.z += .28;
        if (g.position.z > 22) g.position.z = -70;
        g.rotation.z = t * .2 + i;
      });
      world.rotation.x = -ptr.y * .12;
      world.rotation.y = ptr.x * .12;
      world.position.y = s * 6;
    };
  }
};

/* ==========================================================================
   ARRANQUE — después de la carga y con el navegador libre, para que el 3D
   nunca compita con el texto, las fuentes ni la primera pintura.
   ========================================================================== */
function cuandoLibre(fn) {
  const ric = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  const go = () => ric(fn, { timeout: 1500 });
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

if (!host || reduced) {
  bail();
} else {
  cuandoLibre(() => {
    boot(host, host.dataset.scene || 'core').catch(bail);
  });
}
