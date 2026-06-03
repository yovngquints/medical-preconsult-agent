require('dotenv').config();
const { getConversation, saveConversation, deleteConversation } = require('./database');
const { extractData, generateSummary } = require('./claude');
const { sendMessage } = require('./whatsapp');

const DOCTOR_PHONE = process.env.DOCTOR_PHONE;

// Mensajes que envía el agente en cada estado
const MESSAGES = {
  GREETING: `¡Hola! 👋 Soy el asistente de pre-consulta del consultorio. Voy a hacerte unas preguntas rápidas para que tu médico esté preparado cuando te atienda.

¿Cuál es el *motivo principal* de tu consulta hoy? Descríbelo con tus propias palabras.`,

  EVOLUTION_TIME: `Entendido. ¿Hace cuánto tiempo llevas con este problema? (Ejemplo: "desde ayer", "3 días", "2 semanas")`,

  MEDICATIONS: `¿Estás tomando algún medicamento actualmente? Por favor menciona el nombre si lo recuerdas. Si no tomas ninguno, escribe *"ninguno"*.`,

  ALLERGIES: `¿Tienes alguna alergia conocida a medicamentos, alimentos u otras sustancias? Si no tienes, escribe *"ninguna"*.`,

  MEDICAL_HISTORY: `¿Tienes algún antecedente médico importante? Por ejemplo: diabetes, hipertensión, enfermedades del corazón, cirugías previas, hospitalizaciones. Si no tienes ninguno, escribe *"ninguno"*.`,

  PATIENT_INFO: `Casi terminamos. Por favor escribe tu *nombre completo* y tu *edad*. Ejemplo: "Juan Pérez, 35 años"`,

  SUMMARY_SENT: `✅ ¡Listo! Tu información ha sido enviada al médico.

Cuando llegues a la consulta, ya tendrá un resumen de tu caso. ¡Que te mejores pronto! 😊`
};

const STATE_FLOW = [
  'GREETING',
  'EVOLUTION_TIME',
  'MEDICATIONS',
  'ALLERGIES',
  'MEDICAL_HISTORY',
  'PATIENT_INFO',
  'SUMMARY_SENT'
];

// Mapea qué campo de datos llena cada respuesta
const STATE_TO_DATA_FIELD = {
  GREETING: 'symptoms',
  EVOLUTION_TIME: 'evolutionTime',
  MEDICATIONS: 'medications',
  ALLERGIES: 'allergies',
  MEDICAL_HISTORY: 'medicalHistory',
  PATIENT_INFO: 'patientInfo'
};

async function handleMessage(phone, incomingText) {
  let conversation = getConversation(phone);

  // Conversación nueva: enviar saludo y pasar al primer estado real
  if (!conversation) {
    conversation = { state: 'GREETING', data: {} };
    saveConversation(phone, 'GREETING', {});
    await sendMessage(phone, MESSAGES.GREETING);
    return;
  }

  const { state, data } = conversation;

  // Si ya terminó la conversación, ignorar mensajes adicionales
  if (state === 'SUMMARY_SENT') {
    await sendMessage(phone, '¡Hola de nuevo! Si necesitas una nueva pre-consulta, escribe *"nueva consulta"* para empezar.');
    return;
  }

  // Si el paciente quiere reiniciar
  if (incomingText.toLowerCase().includes('nueva consulta')) {
    deleteConversation(phone);
    await handleMessage(phone, '');
    return;
  }

  // Extraer y guardar el dato del estado actual
  const dataField = STATE_TO_DATA_FIELD[state];
  if (dataField) {
    let extracted;

    if (dataField === 'patientInfo') {
      const raw = await extractData('PATIENT_INFO', incomingText);
      try {
        const parsed = JSON.parse(raw);
        data.name = parsed.name || 'No proporcionado';
        data.age = parsed.age || 'No proporcionada';
      } catch {
        // Si Claude no devuelve JSON válido, guardar texto crudo
        data.name = incomingText;
        data.age = 'No especificada';
      }
    } else {
      extracted = await extractData(state, incomingText);
      data[dataField] = extracted;
    }
  }

  // Avanzar al siguiente estado
  const currentIndex = STATE_FLOW.indexOf(state);
  const nextState = STATE_FLOW[currentIndex + 1];

  if (nextState === 'SUMMARY_SENT') {
    // Generar y enviar el resumen al médico
    const summary = await generateSummary(data);

    await sendMessage(
      DOCTOR_PHONE,
      `📩 *Nueva pre-consulta recibida*\n\n${summary}`
    );

    // Confirmar al paciente
    await sendMessage(phone, MESSAGES.SUMMARY_SENT);
    saveConversation(phone, 'SUMMARY_SENT', data);
  } else {
    // Enviar la siguiente pregunta
    saveConversation(phone, nextState, data);
    await sendMessage(phone, MESSAGES[nextState]);
  }
}

module.exports = { handleMessage };
