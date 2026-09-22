/* ============================================================================
   SP Automatizaciones — Motor 3D (WebGL / Three.js)
   Una escena distinta por página, declarada con   <div class="stage-canvas"
   data-scene="core|grid|orbit|globe|tunnel">
   Degradación: sin WebGL o con prefers-reduced-motion → fondo CSS animado.
   ========================================================================== */
import * as THREE from 'three';

const host = document.querySelector('[data-scene]');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function bail() { if (host) host.classList.add('fallback'); }

/* --- sprite circular suave, generado en canvas (sin peticiones externas) --- */
function dotTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d').createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.35, 'rgba(255,255,255,.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const ACC  = new THREE.Color('#c4f82a');   // lima del logotipo
const ACC2 = new THREE.Color('#6e5bff');   // violeta de profundidad
const ACC3 = new THREE.Color('#e9ff9c');   // lima pálido

function boot(mount, kind) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  mount.appendChild(canvas);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
  camera.position.set(0, 0, 26);

  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.AmbientLight(0xffffff, .5));
  const key = new THREE.PointLight(ACC, 220, 90);  key.position.set(14, 12, 18);  scene.add(key);
  const rim = new THREE.PointLight(ACC2, 180, 90); rim.position.set(-16, -8, 10);  scene.add(rim);

  const sprite = dotTexture();
  const build = SCENES[kind] || SCENES.core;
  const tick  = build(world, { sprite, camera });

  /* ---- interacción ---- */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollN = 0;

  const onPointer = (e) => {
    ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const onScroll = () => {
    const r = mount.getBoundingClientRect();
    scrollN = -r.top / Math.max(r.height, 1);   // 0 arriba → 1 fuera de pantalla
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();
  onScroll();

  /* ---- loop (se detiene si la pestaña o la sección no están visibles) ---- */
  const clock = new THREE.Clock();
  let visible = true, running = true, raf = 0;

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); },
    { threshold: 0 }).observe(mount);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  function frame() {
    if (!running) return;
    if (!visible || document.hidden) { running = false; return; }
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    ptr.x += (ptr.tx - ptr.x) * .045;
    ptr.y += (ptr.ty - ptr.y) * .045;

    tick(t, ptr, scrollN);

    camera.position.x += (ptr.x * 3.2 - camera.position.x) * .04;
    camera.position.y += (-ptr.y * 2.2 - camera.position.y) * .04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  function start() { if (!running && visible && !document.hidden) { running = true; clock.getDelta(); frame(); } }
  function stop()  { running = false; cancelAnimationFrame(raf); }
  frame();
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
      new THREE.MeshStandardMaterial({
        color: '#0b1a18', metalness: .85, roughness: .25,
        emissive: ACC, emissiveIntensity: .12, flatShading: true
      })
    );
    world.add(core, shell, solid);

    // nube de partículas esférica
    const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
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
    const SIZE = 46, STEP = 1.05;
    const pts = [];
    for (let x = -SIZE / 2; x < SIZE / 2; x += STEP)
      for (let z = -SIZE / 2; z < SIZE / 2; z += STEP) pts.push(x, 0, z);

    const geo = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const base = Float32Array.from(pts);

    const mesh = new THREE.Points(geo, new THREE.PointsMaterial({
      size: .19, map: sprite, color: ACC, transparent: true, opacity: .75,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    mesh.rotation.x = -Math.PI / 2.55;
    mesh.position.y = -4;
    world.add(mesh);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(10, .03, 8, 140),
      new THREE.MeshBasicMaterial({ color: ACC2, transparent: true, opacity: .4 })
    );
    halo.rotation.x = -Math.PI / 2.55;
    halo.position.y = 2.2;
    world.add(halo);

    const arr = geo.attributes.position.array;
    return (t, ptr, s) => {
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i], z = base[i + 2];
        arr[i + 1] = Math.sin(x * .22 + t * 1.1) * 1.5
                   + Math.cos(z * .18 - t * .8) * 1.2
                   + Math.sin((x + z) * .1 + t * .5) * .9;
      }
      geo.attributes.position.needsUpdate = true;
      mesh.rotation.z = ptr.x * .12;
      halo.rotation.z = t * .3;
      halo.scale.setScalar(1 + Math.sin(t * .8) * .06);
      world.position.y = s * 8;
    };
  },

  /* --- CASOS: sistema de órbitas con satélites (proyectos en producción) --- */
  orbit(world, { sprite }) {
    const sun = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.6, 1),
      new THREE.MeshStandardMaterial({
        color: '#08120f', metalness: .9, roughness: .3,
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

    const N = 1400, pos = new Float32Array(N * 3);
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
      new THREE.MeshStandardMaterial({
        color: '#060d0c', metalness: .9, roughness: .35,
        emissive: ACC2, emissiveIntensity: .1
      })
    );
    world.add(globe, inner);

    const N = 1100, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
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
    const N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
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
      size: .2, map: sprite, vertexColors: true, transparent: true, opacity: .9,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    world.add(flow);

    const gates = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Mesh(
        new THREE.TorusGeometry(6.5, .02, 6, 100),
        new THREE.MeshBasicMaterial({ color: i % 2 ? ACC : ACC2, transparent: true, opacity: .3 })
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
   ARRANQUE  (al final del módulo: SCENES y las constantes de color deben
   estar ya inicializadas antes de la primera llamada a boot)
   ========================================================================== */
if (!host || reduced) {
  bail();
} else {
  try {
    boot(host, host.dataset.scene || 'core');
  } catch (err) {
    console.warn('[3D] desactivado, se usa el fondo CSS:', err);
    bail();
  }
}
