require('dotenv').config();
const express = require('express');
const { handleMessage } = require('./conversation');
const { extractPhone, extractMessageText } = require('./whatsapp');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'medical-preconsult-agent' });
});

// Webhook de Evolution API
app.post('/webhook', async (req, res) => {
  // Verificar token de seguridad (Evolution lo envía como query param o header)
  const token = req.query.token || req.headers['x-webhook-token'];
  if (WEBHOOK_SECRET && token !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;

  // Solo procesar eventos de mensajes nuevos entrantes
  if (body.event !== 'messages.upsert') {
    return res.sendStatus(200);
  }

  const data = body.data;
  if (!data || !data.key) {
    return res.sendStatus(200);
  }

  // Ignorar mensajes propios (fromMe = true)
  if (data.key.fromMe) {
    return res.sendStatus(200);
  }

  // Ignorar mensajes de grupos
  const remoteJid = data.key.remoteJid || '';
  if (remoteJid.includes('@g.us')) {
    return res.sendStatus(200);
  }

  const phone = extractPhone(remoteJid);
  const text = extractMessageText(data);

  if (!phone || !text) {
    return res.sendStatus(200);
  }

  // Responder 200 inmediatamente para que Evolution no reintente
  res.sendStatus(200);

  // Procesar el mensaje de forma asíncrona
  try {
    await handleMessage(phone, text);
  } catch (error) {
    console.error(`[Error] Procesando mensaje de ${phone}:`, error.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Agente médico corriendo en puerto ${PORT}`);
  console.log(`📍 Webhook URL: http://tu-servidor:${PORT}/webhook`);
});
