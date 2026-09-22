# Formulario → Hoja de cálculo + aviso en Telegram

Cada solicitud de `contacto.html` se guarda en una hoja de Google y te
llega al móvil como mensaje de Telegram. Todo corre en los servidores de
Google: **no depende de que tengas ningún servidor encendido**.

```
 Web (contacto.html)  ──POST──►  Apps Script  ──►  Hoja de cálculo
                                      │
                                      └──────────►  Telegram (tu móvil)
```

Tiempo total: unos 20 minutos. Coste: cero.

> **Seguridad:** el token de Telegram se pega **solo** en el editor de
> Apps Script, dentro de tu cuenta de Google. Nunca en este repositorio
> ni en la web — el repositorio es público.

---

## Paso 1 — Crear el bot de Telegram (3 min)

1. En Telegram busca **@BotFather** (tiene la marca azul de verificado).
2. Escríbele `/newbot`.
3. Te pide un **nombre** (lo que ves en el chat), por ejemplo
   `SP Solicitudes`.
4. Te pide un **usuario**, que debe terminar en `bot`, por ejemplo
   `sp_solicitudes_bot`.
5. Te responde con un **token** parecido a
   `7123456789:AAHfd8s...`. Cópialo; lo usas en el paso 3.
6. Abre tu bot nuevo (BotFather te deja el enlace) y escríbele
   **`hola`**. Sin ese primer mensaje el bot no puede escribirte.

## Paso 2 — Crear la hoja y pegar el script (3 min)

1. Ve a <https://sheets.google.com> y crea una hoja en blanco.
   Llámala, por ejemplo, `Solicitudes web`.
2. Menú **Extensiones → Apps Script**.
3. Borra todo lo que haya en el editor.
4. Pega el contenido completo de
   **[`integraciones/formulario-telegram.gs`](integraciones/formulario-telegram.gs)**.
5. Pulsa 💾 **Guardar**.

## Paso 3 — Conectar el bot (5 min)

Arriba del script está el bloque de configuración:

```javascript
const TELEGRAM_TOKEN   = '';
const TELEGRAM_CHAT_ID = '';
```

1. Pega el **token** del paso 1 entre las comillas de `TELEGRAM_TOKEN`.
   Guarda.
2. En el desplegable de funciones (arriba, junto a ▶ Ejecutar) elige
   **`obtenerChatId`** y pulsa **▶ Ejecutar**.
   - La primera vez Google pide permisos: **Revisar permisos** → tu
     cuenta → *Configuración avanzada* → *Ir a (proyecto)* → **Permitir**.
     Aparece el aviso de "app no verificada" porque el script es tuyo y
     nadie más lo ha revisado; es normal.
3. En el **Registro de ejecución** verás:
   `✅ Chat id: 123456789`
   Copia ese número en `TELEGRAM_CHAT_ID`. Guarda.
4. Elige **`probarTelegram`** y ejecútalo.
   **Te debe llegar un mensaje al móvil.** Si llega, el bot está listo.

## Paso 4 — Publicar el script (3 min)

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙️ junto a "Seleccionar tipo" elige
   **Aplicación web**.
3. Configura:
   - *Descripción*: `Formulario web`
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier usuario** ← imprescindible;
     si no, la web no puede enviarle datos.
4. **Implementar** y copia la **URL de la aplicación web**.
   Termina en `/exec`.
5. Compruébala: ábrela en el navegador. Debe mostrar
   `{"ok":true,...,"estado":"activo"}`.

## Paso 5 — Conectar la web

**Mándame la URL `/exec`** y la conecto y publico.

O hazlo tú en `assets/js/site.js`, bloque `FORM_CONFIG`:

```js
const FORM_CONFIG = {
  mode: 'endpoint',
  ...
  endpointUrl: 'https://script.google.com/macros/s/AKfy.../exec'
};
```

La URL `/exec` sí puede ir en la web: solo sirve para *enviar*
solicitudes, no para leer la hoja.

## Paso 6 — Prueba final

Entra a la página de contacto publicada, envía una solicitud de prueba y
comprueba las dos cosas: la fila nueva en la hoja y el mensaje en
Telegram.

---

## Qué hace el script por ti

| Protección | Qué evita |
|---|---|
| Guarda **antes** de avisar | Si Telegram falla, la solicitud no se pierde. La columna *Aviso Telegram* dice `FALLÓ` para que la revises |
| Revalida los datos | Envíos directos a la URL saltándose la web |
| Tope de **30 envíos por hora** | Que un robot te llene la hoja y el móvil. Ajustable en `MAX_POR_HORA` |
| Neutraliza fórmulas | Que un texto como `=IMPORTXML(...)` se ejecute al abrir la hoja; y que `+57 300…` pierda el signo |
| Recorta textos gigantes | Mensajes que Telegram rechazaría (límite 4096 caracteres) |
| Bloqueo de escritura | Que dos envíos simultáneos se pisen |

Además, la web lleva una trampa antispam invisible que descarta robots
antes de llegar al script.

## Herramientas del editor

Desde el desplegable de funciones → ▶ Ejecutar:

| Función | Para qué |
|---|---|
| `obtenerChatId` | Averiguar tu chat id |
| `probarTelegram` | Mandar un mensaje de prueba al móvil |
| `probarFormulario` | Simular un envío completo: fila en la hoja + Telegram |

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La web dice "No pudimos enviar tu solicitud" | *Quién tiene acceso* no está en **Cualquier usuario**, o la URL no termina en `/exec` |
| Llega la fila pero no el Telegram | Token o chat id mal copiados. Ejecuta `probarTelegram` |
| `obtenerChatId` dice que no hay mensajes | No le escribiste `hola` al bot |
| Cambié el script y no se nota | Hay que publicar versión nueva: **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. La URL no cambia |

Para ver errores del lado de Google: en Apps Script, menú izquierdo
**Ejecuciones**.

---

## Alternativas (por si algún día cambias)

El formulario soporta otros destinos cambiando `mode` en `FORM_CONFIG`:

- **`'google-forms'`** — publica en un Formulario de Google. Más simple,
  pero Google no deja que la web lea su respuesta: el envío llega sin
  que la web pueda confirmarlo. Necesita `googleFormId` y un
  `entry.XXXX` por pregunta en `entries`.
- **`'endpoint'` hacia n8n** — un nodo *Webhook* (POST) con respuesta
  `Access-Control-Allow-Origin: *`. Depende de que tu servidor n8n esté
  en línea.

El cuerpo que envía la web es JSON con las claves
`name`, `company`, `email`, `phone`, `need`, `origen` y `fecha`.
