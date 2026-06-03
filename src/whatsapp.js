require('dotenv').config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

async function sendMessage(phone, text) {
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number: phone,
      text: text
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Evolution API error ${response.status}: ${error}`);
  }

  return response.json();
}

// Extrae el número de teléfono limpio desde el remoteJid de Evolution API
// Formato de entrada: "573001234567@s.whatsapp.net" o "573001234567"
function extractPhone(remoteJid) {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
}

// Extrae el texto del mensaje desde el payload de Evolution API
function extractMessageText(data) {
  const msg = data.message;
  if (!msg) return null;
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    null
  );
}

module.exports = { sendMessage, extractPhone, extractMessageText };
