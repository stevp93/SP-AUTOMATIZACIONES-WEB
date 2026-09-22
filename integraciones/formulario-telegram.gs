/**
 * SP Automatizaciones — Receptor del formulario de contacto
 * ---------------------------------------------------------------------------
 * Se pega en: Hoja de cálculo → Extensiones → Apps Script.
 * Guarda cada solicitud en la hoja y avisa al móvil por Telegram.
 * Corre en los servidores de Google: no depende de ningún servidor propio.
 *
 * Paso a paso completo en INTEGRACIONES.md.
 *
 * ⚠️  El token de Telegram se pega SOLO aquí, en el editor de Apps Script.
 *     Nunca en el repositorio ni en la web: el repositorio es público.
 */

// ============ CONFIGURACIÓN ================================================
const TELEGRAM_TOKEN   = '';   // Te lo da @BotFather al crear el bot
const TELEGRAM_CHAT_ID = '';   // Ejecuta obtenerChatId() para conocerlo
const CORREO_RESPALDO  = '';   // Opcional: copia de cada solicitud por correo
const MAX_POR_HORA     = 30;   // Freno antispam: envíos aceptados por hora
const ZONA_HORARIA     = 'America/Bogota';
// ===========================================================================

const COLUMNAS = ['Fecha', 'Nombre', 'Empresa', 'Correo', 'Teléfono',
                  'Necesidad', 'Página', 'Aviso Telegram'];

const LARGOS = { name: 120, company: 160, email: 160, phone: 40,
                 need: 4000, origen: 200 };


/** Recibe el formulario de la web. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = leerDatos_(e);
    if (!d) return responder_({ ok: false, error: 'formato' });

    const error = validar_(d);
    if (error) return responder_({ ok: false, error: error });

    if (!lock.tryLock(10000)) return responder_({ ok: false, error: 'ocupado' });
    if (excedeLimite_()) return responder_({ ok: false, error: 'limite' });

    // 1) Primero se guarda: aunque Telegram falle, la solicitud no se pierde.
    const hoja = hoja_();
    hoja.appendRow([
      new Date(), celda_(d.name), celda_(d.company), celda_(d.email),
      celda_(d.phone), celda_(d.need), celda_(d.origen), 'pendiente'
    ]);
    const fila = hoja.getLastRow();

    // 2) Después se avisa, y se deja constancia de si el aviso salió.
    const estado = avisarTelegram_(d);
    hoja.getRange(fila, COLUMNAS.length).setValue(estado);

    if (CORREO_RESPALDO) {
      MailApp.sendEmail(CORREO_RESPALDO,
        'Nueva solicitud: ' + d.company, mensaje_(d));
    }

    return responder_({ ok: true });
  } catch (err) {
    console.error('doPost:', err);
    return responder_({ ok: false, error: 'interno' });
  } finally {
    lock.releaseLock();
  }
}


/** Abrir la URL /exec en el navegador confirma que el despliegue está vivo. */
function doGet() {
  return responder_({ ok: true, servicio: 'Formulario SP Automatizaciones',
                      estado: 'activo' });
}


// ============ HERRAMIENTAS PARA EJECUTAR DESDE EL EDITOR ===================
// Elige la función en el desplegable de arriba y pulsa ▶ Ejecutar.
// El resultado sale en el "Registro de ejecución".

/** Paso 1: muestra tu chat id. Antes, escríbele "hola" a tu bot. */
function obtenerChatId() {
  if (!TELEGRAM_TOKEN) {
    console.log('❌ Primero pega el TELEGRAM_TOKEN arriba y guarda.');
    return;
  }
  const res = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getUpdates',
    { muteHttpExceptions: true });
  const json = JSON.parse(res.getContentText());
  if (!json.ok) {
    console.log('❌ Telegram rechazó el token. Revísalo en @BotFather.');
    return;
  }
  const chats = {};
  json.result.forEach(function (u) {
    const m = u.message || u.edited_message;
    if (m && m.chat) chats[m.chat.id] = m.chat.first_name || m.chat.title || '';
  });
  const ids = Object.keys(chats);
  if (!ids.length) {
    console.log('⚠️  No hay mensajes. Abre tu bot en Telegram, escríbele ' +
                '"hola" y vuelve a ejecutar esta función.');
    return;
  }
  ids.forEach(function (id) {
    console.log('✅ Chat id: ' + id + '  (' + chats[id] + ')');
  });
  console.log('Copia ese número en TELEGRAM_CHAT_ID y guarda.');
}

/** Paso 2: manda un mensaje de prueba a tu móvil. */
function probarTelegram() {
  const estado = avisarTelegram_({
    name: 'Prueba', company: 'SP Automatizaciones', email: 'prueba@ejemplo.com',
    phone: '', need: 'Si ves este mensaje en el móvil, el bot funciona.',
    origen: 'editor de Apps Script'
  });
  console.log(estado === 'enviado'
    ? '✅ Mensaje enviado. Revisa Telegram en tu móvil.'
    : '❌ No salió (' + estado + '). Revisa token y chat id.');
}

/** Paso 3: simula un envío completo de la web (hoja + Telegram). */
function probarFormulario() {
  const res = doPost({ postData: { contents: JSON.stringify({
    name: 'Cliente de prueba', company: 'Empresa Demo', email: 'demo@empresa.com',
    phone: '+57 300 000 0000',
    need: 'Prueba de extremo a extremo desde el editor de Apps Script.',
    origen: '/contacto.html'
  }) } });
  console.log('Respuesta: ' + res.getContent());
  console.log('Revisa la hoja (fila nueva) y tu Telegram.');
}


// ============ INTERNO =======================================================

function leerDatos_(e) {
  try {
    const raw = JSON.parse(e.postData.contents);
    const d = {};
    Object.keys(LARGOS).forEach(function (k) {
      d[k] = String(raw[k] == null ? '' : raw[k]).trim().slice(0, LARGOS[k]);
    });
    return d;
  } catch (err) {
    return null;
  }
}

function validar_(d) {
  if (!d.name)    return 'nombre';
  if (!d.company) return 'empresa';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'correo';
  if (d.need.length < 12) return 'necesidad';
  return '';
}

/** Freno por hora, compartido entre todas las peticiones. */
function excedeLimite_() {
  const cache = CacheService.getScriptCache();
  const clave = 'envios_' + Utilities.formatDate(new Date(), 'GMT', 'yyyyMMddHH');
  const n = Number(cache.get(clave) || 0);
  if (n >= MAX_POR_HORA) return true;
  cache.put(clave, String(n + 1), 3600);
  return false;
}

/**
 * Evita que un texto se interprete como fórmula en la hoja.
 * Sin esto, "=IMPORTXML(...)" en un campo se ejecutaría al abrir la hoja,
 * y "+57 300..." perdería el signo al convertirse en número.
 */
function celda_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function hoja_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold');
  }
  return hoja;
}

function mensaje_(d) {
  const cuando = Utilities.formatDate(new Date(), ZONA_HORARIA, 'dd/MM/yyyy HH:mm');
  return '🔔 Nueva solicitud — SP Automatizaciones\n\n' +
         '👤 ' + d.name + '\n' +
         '🏢 ' + d.company + '\n' +
         '✉️ ' + d.email + '\n' +
         '📱 ' + (d.phone || 'no indicó') + '\n\n' +
         '📝 Necesita:\n' + d.need + '\n\n' +
         '🕒 ' + cuando + ' · ' + (d.origen || 'web');
}

/** Devuelve 'enviado', 'sin configurar' o 'FALLÓ (código)'. */
function avisarTelegram_(d) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return 'sin configurar';
  try {
    const res = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage',
      {
        method: 'post',
        payload: {
          chat_id: TELEGRAM_CHAT_ID,
          text: mensaje_(d).slice(0, 4000),   // límite de Telegram: 4096
          disable_web_page_preview: 'true'
        },
        muteHttpExceptions: true
      });
    const code = res.getResponseCode();
    return code === 200 ? 'enviado' : 'FALLÓ (' + code + ')';
  } catch (err) {
    console.error('Telegram:', err);
    return 'FALLÓ (red)';
  }
}

function responder_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
