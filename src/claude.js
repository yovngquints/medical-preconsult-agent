require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Extrae datos estructurados de una respuesta libre del paciente
async function extractData(field, userMessage) {
  const prompts = {
    SYMPTOMS: `El paciente describió su motivo de consulta. Extrae el síntoma o queja principal en máximo 2 frases claras y concisas. Si menciona varios síntomas, listarlos brevemente. Responde SOLO con la extracción, sin introducción.

Mensaje del paciente: "${userMessage}"`,

    EVOLUTION_TIME: `El paciente indicó cuánto tiempo lleva con sus síntomas. Extrae el tiempo de evolución en formato claro (ej: "3 días", "2 semanas", "desde hace 1 mes"). Si es ambiguo, usa sus palabras exactas. Responde SOLO con el tiempo extraído.

Mensaje del paciente: "${userMessage}"`,

    MEDICATIONS: `El paciente mencionó sus medicamentos actuales. Extrae la lista de medicamentos. Si no toma ninguno, responde "Ninguno". Responde SOLO con la lista o "Ninguno".

Mensaje del paciente: "${userMessage}"`,

    ALLERGIES: `El paciente mencionó sus alergias conocidas. Extrae las alergias (medicamentos, alimentos, etc.). Si no tiene, responde "Ninguna conocida". Responde SOLO con las alergias o "Ninguna conocida".

Mensaje del paciente: "${userMessage}"`,

    MEDICAL_HISTORY: `El paciente mencionó sus antecedentes médicos. Extrae los antecedentes relevantes (enfermedades crónicas, cirugías, hospitalizaciones). Si no tiene, responde "Sin antecedentes relevantes". Responde SOLO con los antecedentes.

Mensaje del paciente: "${userMessage}"`,

    PATIENT_INFO: `El paciente proporcionó su nombre y edad. Extrae ÚNICAMENTE en formato JSON así: {"name": "Nombre Completo", "age": "XX años"}. Si solo da nombre sin edad o viceversa, pon null en el faltante. Responde SOLO con el JSON.

Mensaje del paciente: "${userMessage}"`
  };

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompts[field] }]
  });

  return message.content[0].text.trim();
}

// Genera el resumen estructurado final
async function generateSummary(data) {
  const prompt = `Genera un resumen de pre-consulta médica profesional y conciso a partir de los siguientes datos recopilados por WhatsApp. El resumen es para un médico general colombiano.

DATOS DEL PACIENTE:
- Nombre: ${data.name || 'No proporcionado'}
- Edad: ${data.age || 'No proporcionada'}
- Motivo de consulta: ${data.symptoms || 'No especificado'}
- Tiempo de evolución: ${data.evolutionTime || 'No especificado'}
- Medicamentos actuales: ${data.medications || 'Ninguno'}
- Alergias conocidas: ${data.allergies || 'Ninguna conocida'}
- Antecedentes médicos: ${data.medicalHistory || 'Sin antecedentes relevantes'}

Formato de salida (usa exactamente estos encabezados con emoji):
🏥 *RESUMEN PRE-CONSULTA*
📋 *Paciente:* [nombre y edad]
🔍 *Motivo de consulta:* [síntoma principal]
⏱ *Evolución:* [tiempo]
💊 *Medicamentos:* [lista o ninguno]
⚠️ *Alergias:* [lista o ninguna]
📁 *Antecedentes:* [lista o ninguno]
📝 *Nota:* Información recopilada por agente de pre-consulta vía WhatsApp.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  return message.content[0].text.trim();
}

module.exports = { extractData, generateSummary };
