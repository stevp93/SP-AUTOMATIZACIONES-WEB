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
  css/core.css            design system completo (tokens, componentes, responsive)
  js/scene.js             motor 3D: una escena por página, elegida con data-scene="…"
  js/site.js              nav, cursor, reveals, tilt 3D, contadores, acordeón, formulario
  vendor/three.module.min.js   Three.js r169 minificado (licencia MIT al lado)
  fonts/*.woff2           Space Grotesk, Inter y JetBrains Mono (licencia OFL al lado)
```

La escena se declara en el HTML con `<div class="stage-canvas" data-scene="core">`.
Para cambiar la escena de una página basta con cambiar ese atributo.

Todo se sirve desde el propio dominio: **cero peticiones a servidores externos**.

## Rendimiento

Lighthouse, las 5 páginas (móvil con CPU ×4 y 4G lento simulados):

| | Antes | Ahora |
|---|---|---|
| Rendimiento móvil | 47–50 | **99** |
| Rendimiento escritorio | 59–68 | **100** |
| LCP móvil | 5,2–5,6 s | **1,9–2,0 s** |
| Bloqueo del hilo (TBT) móvil | 1,8–2,2 s | **0–50 ms** |
| Accesibilidad / SEO | 92–95 / 92 | **100 / 100** |
| Peso de la página | 440 KB | **185 KB** |

Cómo se consigue sin renunciar al 3D:

- **El 3D nunca retrasa el contenido.** `scene.js` no importa Three.js de forma
  estática: espera a que la página cargue y el navegador quede libre, y solo
  entonces lo descarga. El titular se anima con CSS puro (las palabras vienen
  ya separadas en el HTML), sin esperar a ningún JavaScript.
- **Sin bloqueos al arrancar.** Las fases (contexto WebGL, escena, shaders) van
  en tareas separadas; los shaders se compilan en paralelo cuando el navegador
  lo permite, o de a un material por tarea con el canvas aún invisible.
- **Sin GPU no hay 3D.** Una sonda en un Web Worker pregunta al navegador si el
  WebGL iría por software (`failIfMajorPerformanceCaveat`). Si es así, se usa el
  fondo CSS y ni siquiera se descarga Three.js. Es lo que ven PageSpeed Insights
  y los equipos sin aceleración gráfica.
- **Móviles y tablets**: resolución limitada a 1,5×, ~45% menos partículas, el
  canvas solo cubre la primera pantalla, encuadre de cámara adaptado a
  pantallas verticales, y la cámara se mece sola (no hay ratón).
- **Vigilante de fluidez**: si un teléfono no llega a ~30 fps, baja la
  resolución; si aun así no llega, cede al fondo CSS.
- El render se detiene fuera de pantalla, con la pestaña oculta o si el sistema
  retira el contexto WebGL (se recupera solo al volver).

Para ver el 3D en un equipo sin GPU (pruebas): añade `?3d=1` a la URL.

## Accesibilidad

- Navegación por teclado, `aria-current`, enlace de salto al contenido,
  foco visible y errores de formulario con causa + solución.
- Contraste de todo el texto ≥ 4,5:1 (WCAG AA).
- `prefers-reduced-motion`: sin 3D y sin animaciones.

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

1. **Formulario** — el receptor ya está escrito y probado:
   [`integraciones/formulario-telegram.gs`](integraciones/formulario-telegram.gs)
   (Apps Script: guarda en una hoja de Google y avisa por Telegram).
   Falta montarlo en tu cuenta siguiendo **[INTEGRACIONES.md](INTEGRACIONES.md)**
   y pegar la URL `/exec` en `FORM_CONFIG` de `assets/js/site.js`.
   Mientras siga en `mode: 'demo'`, **las solicitudes no llegan a ningún lado**.
