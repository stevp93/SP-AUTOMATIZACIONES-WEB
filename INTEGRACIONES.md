# Conectar el formulario y recibir avisos en el móvil

El formulario de `contacto.html` ya está preparado. Solo hay que decirle
**a dónde** enviar los datos, en `assets/js/site.js`, en el bloque
`FORM_CONFIG` (arriba de la sección 9).

```js
const FORM_CONFIG = {
  mode: 'demo',          // <-- cámbialo
  googleFormId: '',
  entries: { name: '', company: '', email: '', phone: '', need: '' },
  endpointUrl: ''
};
```

Hay dos caminos. Los dos son gratis y los dos avisan al móvil.

---

## Camino A — Formulario de Google (más rápido, ~15 min)

Las respuestas caen en una hoja de cálculo y Google te manda un correo
por cada una. Con la app de Gmail instalada, ese correo **ya es una
notificación en el móvil**.

### A1. Crear el formulario

1. Entra a <https://forms.google.com> y crea un formulario en blanco.
2. Añade **cinco preguntas de respuesta corta**, en este orden y con
   estos títulos (el título es libre, pero así no te confundes):

   | # | Pregunta   | Tipo            |
   |---|------------|-----------------|
   | 1 | Nombre     | Respuesta corta |
   | 2 | Empresa    | Respuesta corta |
   | 3 | Correo     | Respuesta corta |
   | 4 | Teléfono   | Respuesta corta |
   | 5 | Necesidad  | Párrafo         |

   Ninguna debe ser obligatoria: la validación ya la hace la web.

### A2. Sacar los identificadores

1. Pulsa **Enviar** → pestaña del eslabón (🔗) → copia el enlace.
   Se parece a:
   `https://docs.google.com/forms/d/e/1FAIpQLSd...AbCdEf/viewform`
   El tramo entre `/e/` y `/viewform` es tu **`googleFormId`**.
2. Abre el formulario publicado en el navegador, haz clic derecho →
   **Ver código fuente de la página** y busca `entry.`
   Verás algo como `entry.1234567890`, uno por pregunta, en el mismo
   orden en que las creaste.

   > Atajo: en el menú ⋮ del formulario elige **Obtener enlace
   > autocompletado**, rellena cada campo con su propio nombre
   > ("Nombre", "Empresa"…) y envía. El enlace que te da lleva los
   > `entry.XXXX=Nombre` emparejados, sin tener que leer código.

### A3. Configurar la web

```js
const FORM_CONFIG = {
  mode: 'google-forms',
  googleFormId: '1FAIpQLSd...AbCdEf',
  entries: {
    name:    'entry.1111111111',
    company: 'entry.2222222222',
    email:   'entry.3333333333',
    phone:   'entry.4444444444',
    need:    'entry.5555555555'
  },
  endpointUrl: ''
};
```

### A4. Activar el aviso al móvil

En el formulario: pestaña **Respuestas** → menú ⋮ →
**Recibir notificaciones por correo de nuevas respuestas**.

Instala **Gmail** en el móvil con esa cuenta y activa sus notificaciones.
Cada solicitud te llegará como aviso al instante.

### Límite honesto de este camino

Google no permite que una web ajena lea su respuesta (no envía cabeceras
CORS). El envío **sí llega**, pero el navegador no nos deja comprobarlo:
la web muestra "¡Solicitud recibida!" sin poder confirmar que Google la
aceptó. Solo detectamos caídas de red. Si quieres confirmación real, usa
el camino B.

---

## Camino B — Apps Script (recomendado, ~25 min)

Mismo coste (cero) y sin los límites de arriba: la web **sí** confirma
que el dato se guardó, y el aviso al móvil puede ser un mensaje de
**Telegram**, que llega más rápido y se ve mejor que un correo.

### B1. Crear la hoja y el script

1. Crea una hoja de cálculo nueva en <https://sheets.google.com>.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya y pega esto:

```javascript
// Pega aquí los datos de tu bot de Telegram (ver paso B3).
// Déjalos vacíos si prefieres recibir solo el correo.
const TELEGRAM_TOKEN = '';
const TELEGRAM_CHAT_ID = '';

// Si quieres además un correo, pon tu dirección. Vacío = sin correo.
const CORREO_AVISO = '';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    SpreadsheetApp.getActiveSheet().appendRow([
      new Date(), d.name, d.company, d.email, d.phone, d.need, d.origen
    ]);

    const texto =
      '🔔 Nueva solicitud en SP Automatizaciones\n\n' +
      'Nombre: '   + d.name    + '\n' +
      'Empresa: '  + d.company + '\n' +
      'Correo: '   + d.email   + '\n' +
      'Teléfono: ' + (d.phone || '—') + '\n\n' +
      'Necesita:\n' + d.need;

    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      UrlFetchApp.fetch(
        'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage',
        {
          method: 'post',
          payload: { chat_id: TELEGRAM_CHAT_ID, text: texto },
          muteHttpExceptions: true
        }
      );
    }

    if (CORREO_AVISO) {
      MailApp.sendEmail(CORREO_AVISO, 'Nueva solicitud: ' + d.company, texto);
    }

    return responder({ ok: true });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  }
}

function responder(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### B2. Publicarlo

**Implementar → Nueva implementación → Aplicación web**

- *Ejecutar como*: **Yo**
- *Quién tiene acceso*: **Cualquier usuario**  ← imprescindible

Acepta los permisos y copia la URL que termina en `/exec`.
Pégala en `endpointUrl` y pon `mode: 'endpoint'`.

```js
const FORM_CONFIG = {
  mode: 'endpoint',
  googleFormId: '',
  entries: { name: '', company: '', email: '', phone: '', need: '' },
  endpointUrl: 'https://script.google.com/macros/s/AKfy.../exec'
};
```

> Cada vez que edites el script hay que **crear una implementación nueva**
> (o "Gestionar implementaciones → Editar → Versión: Nueva"), o seguirá
> corriendo la versión vieja.

### B3. El bot de Telegram (el aviso al móvil)

1. En Telegram busca **@BotFather** → `/newbot` → dale un nombre.
   Te devuelve un **token** como `7123456:AAH...`.
2. Escríbele cualquier cosa a tu bot recién creado (un simple "hola").
   Sin ese primer mensaje el bot no puede escribirte.
3. Abre en el navegador:
   `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
   Busca `"chat":{"id":123456789` → ese número es tu **chat id**.
4. Pega token y chat id en el script y vuelve a implementar.

Ventaja de Telegram: el aviso llega al móvil al instante y **tu número
nunca aparece en ningún sitio** — ni en la web, ni en el script.

---

## Cuál elegir

| | Camino A (Forms) | Camino B (Apps Script) |
|---|---|---|
| Tiempo de montaje | ~15 min | ~25 min |
| Coste | Gratis | Gratis |
| Confirma que se guardó | No | **Sí** |
| Aviso al móvil | Correo (Gmail) | **Telegram** o correo |
| Los datos quedan en | Hoja de cálculo | Hoja de cálculo |
| Campos nuevos | Hay que crear la pregunta y copiar su `entry.` | Se añaden solos a la hoja |

**Recomendación:** camino B. Cuesta diez minutos más y quita el único
punto ciego del camino A.

---

## Tercera opción: n8n

Si ya tienes n8n corriendo, es el camino más corto de todos y además
la web se convierte en demostración de tu propio servicio:

1. Nodo **Webhook** (POST) → copia la URL de producción.
2. Pégala en `endpointUrl` con `mode: 'endpoint'`.
3. Encadena lo que quieras: Google Sheets, Telegram, correo, un nodo de
   IA que redacte la primera respuesta…

El cuerpo llega como JSON con las claves
`name`, `company`, `email`, `phone`, `need`, `origen` y `fecha`.

> El nodo Webhook debe responder con la cabecera
> `Access-Control-Allow-Origin: *`, o el navegador bloqueará la respuesta.

---

## Probarlo

1. Sirve el sitio (`INICIAR_SERVIDOR.bat` o `python3 -m http.server 8000`).
2. Abre `contacto.html`, rellena el formulario y envía.
3. Comprueba: la fila en la hoja, y el aviso en el móvil.
4. Si falla, abre la consola del navegador (**F12**): el error sale
   marcado como `[formulario] fallo el envío`.

## Antispam

El formulario lleva un campo trampa invisible (`website`). Si un robot lo
rellena, el envío se descarta en silencio, sin molestar a nadie con un
captcha. Si aun así te llega spam, el siguiente paso sería añadir
Cloudflare Turnstile, que también es gratis.
