/* ============================================================================
   SP Automatizaciones — Interacción del sitio
   Nav, cursor, reveals, tilt 3D, contadores, acordeón, formulario,
   transición entre páginas. Sin dependencias.
   ========================================================================== */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine    = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const idle    = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));

  /* ---------------- 1. Scroll: progreso + nav (un solo listener rAF) ------ */
  const bar = $('.progress');
  const nav = $('.nav');
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (bar) {
        const h = document.documentElement.scrollHeight - innerHeight;
        bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
      }
      if (nav) nav.classList.toggle('stuck', y > 30);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- 2. Menú móvil ---------------------------------------- */
  const burger = $('.burger');
  const drawer = $('.drawer');
  if (burger && drawer) {
    let open = false;
    const set = (v) => {
      open = v;
      burger.classList.toggle('on', v);
      drawer.classList.toggle('on', v);
      burger.setAttribute('aria-expanded', String(v));
      burger.setAttribute('aria-label', v ? 'Cerrar menú' : 'Abrir menú');
      document.body.style.overflow = v ? 'hidden' : '';
    };
    burger.addEventListener('click', () => set(!open));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); burger.focus(); } });
    addEventListener('resize', () => { if (open && innerWidth > 820) set(false); });
  }

  /* ---------------- 3. Cursor personalizado ------------------------------ */
  if (fine && !reduced) {
    const ring = document.createElement('div'); ring.className = 'cur';
    const dot  = document.createElement('div'); dot.className  = 'cur-dot';
    document.body.append(ring, dot);
    let rx = innerWidth / 2, ry = innerHeight / 2, tx = rx, ty = ry;

    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    }, { passive: true });

    (function loop() {
      rx += (tx - rx) * .16; ry += (ty - ry) * .16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(loop);
    })();

    const hot = 'a, button, .card, .case, .chip, .acc-btn, input, textarea';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest(hot)) document.body.classList.add('cur-hot');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest(hot)) document.body.classList.remove('cur-hot');
    });
  }

  /* ---------------- 4. Reveals al hacer scroll --------------------------- */
  idle(() => {
    const items = $$('.rv, .rv-l, .rv-3d, [data-words]');
    if (!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -50px 0px' });
    items.forEach((el) => io.observe(el));
  });

  /* ---------------- 5. Títulos con revelado palabra a palabra ------------ */
  $$('[data-words]').forEach((el) => {
    const html = el.innerHTML;
    // conserva los <br> y las etiquetas de énfasis simples envolviendo palabras
    const parts = html.split(/(\s+|<br\s*\/?>)/i);
    let i = 0;
    el.innerHTML = parts.map((p) => {
      if (!p.trim() || /^<br/i.test(p)) return p;
      const d = (i++) * 65;
      return `<span><i style="--d:${d}ms">${p}</i></span>`;
    }).join('');
    el.classList.add('reveal-words');
    if (el.hasAttribute('data-words-now')) requestAnimationFrame(() => el.classList.add('is-in'));
  });

  /* ---------------- 6. Tilt 3D + brillo que sigue al puntero ------------- */
  if (fine && !reduced) {
    $$('.card, .case').forEach((el) => {
      const max = el.classList.contains('case') ? 4 : 9;
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', px * 100 + '%');
        el.style.setProperty('--my', py * 100 + '%');
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform =
            `rotateY(${(px - .5) * max * 2}deg) rotateX(${(.5 - py) * max * 2}deg) translateZ(6px)`;
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });

    /* Botones magnéticos */
    $$('.btn').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform =
          `translate(${(e.clientX - r.left - r.width / 2) * .18}px, ${(e.clientY - r.top - r.height / 2) * .28}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------------- 7. Contadores -------------------------------------- */
  idle(() => {
    const nums = $$('[data-count]');
    if (!nums.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        const end = parseFloat(el.dataset.count);
        const suf = el.dataset.suffix || '';
        if (reduced) { el.textContent = end.toLocaleString('es-CO') + suf; return; }
        const dur = 1400, t0 = performance.now();
        (function step(now) {
          const p = Math.min((now - t0) / dur, 1);
          const v = Math.round(end * (1 - Math.pow(1 - p, 3)));
          el.textContent = v.toLocaleString('es-CO') + suf;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: .5 });
    nums.forEach((n) => io.observe(n));
  });

  /* ---------------- 8. Acordeón (accesible) ----------------------------- */
  $$('.acc-item').forEach((item) => {
    const btn   = $('.acc-btn', item);
    const panel = $('.acc-panel', item);
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const on = item.classList.toggle('on');
      btn.setAttribute('aria-expanded', String(on));
      panel.style.height = on ? panel.scrollHeight + 'px' : '0px';
    });
    panel.style.height = '0px';
  });

  /* ---------------- 9. Formulario de contacto ---------------------------
     Configura el destino aquí. Ver INTEGRACIONES.md para el paso a paso.

       mode: 'demo'          no envía nada, solo muestra la confirmación
             'google-forms'  publica en un Formulario de Google
             'endpoint'      publica JSON en tu propia URL
                             (Apps Script, webhook de n8n, Formspree…)
  ---------------------------------------------------------------------- */
  const FORM_CONFIG = {
    mode: 'demo',

    // --- mode: 'google-forms' -------------------------------------------
    // formId: el tramo que va entre /e/ y /viewform en el enlace del formulario
    googleFormId: '',
    // Un "entry.XXXXXXX" por campo (déjalo vacío si no creaste esa pregunta)
    entries: { name: '', company: '', email: '', phone: '', need: '' },

    // --- mode: 'endpoint' -----------------------------------------------
    endpointUrl: ''
  };

  const form = $('#contactForm');
  if (form) {
    const ok    = $('#formOk');
    const errBx = $('#formErr');
    let dirty = false;

    form.addEventListener('input', () => { dirty = true; });
    addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    const fail = (msg, field) => {
      errBx.style.display = 'block';
      errBx.textContent = msg;
      if (field) field.focus();
    };

    /* Publica en un Formulario de Google.
       Google no devuelve cabeceras CORS, así que la petición va en modo
       'no-cors': el envío llega, pero el navegador NO nos deja leer la
       respuesta. Por eso aquí no se puede distinguir un envío correcto de
       un fallo del servidor; solo detectamos caídas de red. */
    async function sendToGoogleForms(data) {
      const body = new FormData();
      Object.entries(FORM_CONFIG.entries).forEach(([campo, entry]) => {
        if (entry && data[campo]) body.append(entry, data[campo]);
      });
      await fetch(`https://docs.google.com/forms/d/e/${FORM_CONFIG.googleFormId}/formResponse`, {
        method: 'POST', mode: 'no-cors', body
      });
    }

    /* Publica en una URL propia. Se envía como text/plain a propósito:
       evita la petición previa de CORS (preflight), que Apps Script no
       responde bien. En el servidor se lee el cuerpo y se interpreta JSON. */
    async function sendToEndpoint(data) {
      const res = await fetch(FORM_CONFIG.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBx.style.display = 'none';

      // Trampa antispam: es invisible, así que solo un robot la rellena.
      if (form.website && form.website.value) return;

      const data = {
        name:    form.name.value.trim(),
        company: form.company.value.trim(),
        email:   form.email.value.trim(),
        phone:   form.phone ? form.phone.value.trim() : '',
        need:    form.need.value.trim(),
        origen:  location.pathname,
        fecha:   new Date().toISOString()
      };

      if (!data.name)    return fail('Falta tu nombre — escríbelo para saber con quién hablamos.', form.name);
      if (!data.company) return fail('Falta la empresa — indica el nombre de tu organización.', form.company);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
                         return fail('Correo inválido — usa el formato nombre@empresa.com.', form.email);
      if (data.need.length < 12)
                         return fail('Cuéntanos un poco más (mínimo una frase) sobre lo que necesitas.', form.need);

      const btn = $('.form-submit', form);
      const etiqueta = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Enviando…';

      try {
        if (FORM_CONFIG.mode === 'google-forms')  await sendToGoogleForms(data);
        else if (FORM_CONFIG.mode === 'endpoint') await sendToEndpoint(data);
        else await new Promise((r) => setTimeout(r, 900));   // modo demo

        dirty = false;
        form.style.display = 'none';
        ok.style.display = 'grid';
        ok.focus?.();
      } catch (err) {
        console.error('[formulario] fallo el envío:', err);
        btn.disabled = false;
        btn.textContent = etiqueta;
        fail('No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.');
      }
    });
  }

  /* ---------------- 10. Transición entre páginas ------------------------ */
  const veil = $('.veil');
  if (veil) {
    requestAnimationFrame(() => { veil.classList.add('in'); });
    if (!reduced) {
      document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const url = a.getAttribute('href');
        if (!url || a.target === '_blank' || url.startsWith('#') ||
            url.startsWith('mailto:') || url.startsWith('tel:') || /^https?:/i.test(url)) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        veil.classList.remove('in');
        veil.classList.add('out');
        setTimeout(() => { location.href = url; }, 420);
      });
    }
  }

  /* ---------------- 11. Año dinámico en el pie -------------------------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
