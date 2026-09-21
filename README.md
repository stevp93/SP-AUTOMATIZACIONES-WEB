# SP Automatizaciones — Sitio web

Sitio estático **multipágina** con animaciones **3D en WebGL** (Three.js) y 3D en CSS.
Sin build step: se abre con cualquier servidor estático.

## Ejecutar

```
INICIAR_SERVIDOR.bat        (Windows)
python3 -m http.server 8000 (cualquier sistema)
```
Luego abre <http://localhost:8000/index.html>.

> Debe servirse por HTTP, no abriendo el archivo con doble clic:
> `scene.js` es un módulo ES y el `file://` lo bloquea.

## Estructura

| Archivo            | Página            | Escena 3D                                    |
|--------------------|-------------------|----------------------------------------------|
| `index.html`       | Inicio            | `core` — núcleo poliédrico + nube de partículas + anillos |
| `servicios.html`   | Servicios         | `grid` — malla de onda (flujos de datos)     |
| `casos.html`       | Casos de éxito    | `orbit` — sistema orbital con satélites      |
| `nosotros.html`    | Nosotros          | `globe` — globo alámbrico con nodos          |
| `contacto.html`    | Contacto          | `tunnel` — túnel de partículas               |

```
assets/
  css/core.css   design system completo (tokens, componentes, responsive)
  js/scene.js    motor 3D: una escena por página, elegida con data-scene="…"
  js/site.js     nav, cursor, reveals, tilt 3D, contadores, acordeón, formulario
```

La escena se declara en el HTML con `<div class="stage-canvas" data-scene="core">`.
Para cambiar la escena de una página basta con cambiar ese atributo.

## Rendimiento y accesibilidad

- Three.js se carga por CDN mediante `importmap`; el `devicePixelRatio` se limita a 2.
- El bucle de render se detiene cuando la sección sale de pantalla o la pestaña se oculta.
- Si no hay WebGL, el CDN falla o el usuario tiene `prefers-reduced-motion`,
  se usa automáticamente un fondo CSS animado (clase `.fallback`) y todas las
  animaciones se desactivan.
- Navegación por teclado, `aria-current`, enlace de salto al contenido,
  foco visible y errores de formulario con causa + solución.

## Contacto configurado

WhatsApp **+57 304 523 5480** (`wa.me/573045235480`) en los 5 HTML.
Para cambiarlo: `sed -i 's/573045235480/57<nuevo>/g' *.html`

## Pendientes de configuración

1. **Correo** — `contacto@spautomatizaciones.com` aparece en el pie y en
   `contacto.html`; cámbialo si el dominio real es otro.
2. **Formulario** — hoy simula el envío. En `assets/js/site.js`, dentro del
   handler `submit`, sustituye el `setTimeout` marcado con `TODO backend`
   por un `fetch()` a tu endpoint (Formspree, n8n webhook, API propia…).
3. **Imagen Open Graph** — añade `og:image` en el `<head>` cuando tengas el arte.
