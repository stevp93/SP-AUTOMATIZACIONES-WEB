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

## Privacidad

El sitio **no publica ningún dato personal ni de contacto**: sin teléfono,
sin correo, sin dirección ni ciudad. El único canal es el formulario de
`contacto.html`, que capta los datos de quien está interesado
(nombre, empresa, correo, teléfono opcional y necesidad).

Si en el futuro quieres publicar un correo corporativo, añádelo en el pie
(`foot-col` de "Contacto") de las 5 páginas.

## Marca

El logotipo vive en `assets/img/` y de ahí salen todos los tamaños:

| Archivo               | Uso                                    |
|-----------------------|----------------------------------------|
| `logo.png`            | Barra de navegación y pie (transparente) |
| `favicon.ico`         | Pestaña del navegador (16/32/48/64)    |
| `favicon-32.png`      | Pestaña en pantallas modernas          |
| `apple-touch-icon.png`| Icono al guardar en iOS (180px)        |
| `icon-192/512.png`    | Icono de aplicación (`site.webmanifest`) |
| `og.png`              | Miniatura al compartir el enlace (1200x630) |

El acento del sitio (`--acc` en `assets/css/core.css`) es el lima
**#c4f82a** del logotipo, para que marca y web usen el mismo verde.

Para regenerar los iconos tras cambiar el logo, hay que reescalar
`logo.png` a cada tamaño sobre el fondo `#050507`.

## Pendientes de configuración

1. **Formulario** — el envío ya está implementado, pero arranca en modo
   `demo`: muestra la confirmación sin mandar nada a ningún lado.
   Para activarlo, edita `FORM_CONFIG` en `assets/js/site.js` siguiendo
   **[INTEGRACIONES.md](INTEGRACIONES.md)**, que explica paso a paso las
   tres opciones (Formulario de Google, Apps Script o webhook de n8n) y
   cómo recibir el aviso en el móvil por Telegram o correo.
   Mientras siga en `demo`, **las solicitudes no llegan a ningún lado**.
