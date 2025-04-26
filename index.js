const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PUERTO = process.env.PORT || 3000;
const URI_MONGODB = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatdb';
const TOKEN_API_CHUTES = process.env.CHUTES_API_TOKEN;

// Esquema de MongoDB para conversaciones
const esquemaConversacion = new mongoose.Schema({
  idConversacion: { type: String, required: true, unique: true }, // Número de teléfono del usuario
  mensajes: [{
    rol: { type: String, enum: ['usuario', 'asistente'], required: true },
    contenido: { type: String, required: true },
    fecha: { type: Date, default: Date.now }
  }]
});

const Conversacion = mongoose.model('Conversacion', esquemaConversacion);

// Conectar a MongoDB
mongoose.connect(URI_MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

// POST /api/chat - Procesar mensaje de WhatsApp
app.post('/api/chat', async (req, res) => {
  try {
    const { mensaje, numeroTelefono } = req.body;

    if (!mensaje || !numeroTelefono) {
      return res.status(400).json({ error: 'Mensaje y número de teléfono son obligatorios' });
    }

    // Buscar o crear conversación
    let conversacion = await Conversacion.findOne({ idConversacion: numeroTelefono });
    if (!conversacion) {
      conversacion = new Conversacion({ idConversacion: numeroTelefono, mensajes: [] });
    }

    // Agregar mensaje del usuario
    conversacion.mensajes.push({ rol: 'usuario', contenido: mensaje });

    // Preparar mensajes para la API de Chutes con instrucción inicial
    const mensajesApi = [
      {
        role: 'system',
        content: 'Eres un asistente que mantiene el historial de la conversación. Puedes responder preguntas sobre lo que el usuario preguntó anteriormente, usando las marcas de tiempo de los mensajes para dar contexto temporal. Responde de manera natural y precisa.'
      },
      ...conversacion.mensajes.map(msg => ({
        role: msg.rol === 'usuario' ? 'user' : 'assistant',
        content: `[${new Date(msg.fecha).toLocaleString('es-ES')}] ${msg.contenido}`
      }))
    ];

    // Llamar a la API de Chutes AI
    const respuesta = await axios.post(
      'https://llm.chutes.ai/v1/chat/completions',
      {
        model: 'chutesai/Mistral-Small-3.1-24B-Instruct-2503',
        messages: mensajesApi,
        stream: false,
        max_tokens: 512, // Optimizado para respuestas rápidas
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN_API_CHUTES}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const mensajeIA = respuesta.data.choices[0].message.content;

    // Agregar respuesta de la IA
    conversacion.mensajes.push({ rol: 'asistente', contenido: mensajeIA });

    // Guardar conversación
    await conversacion.save();

    res.json({
      idConversacion: numeroTelefono,
      mensaje: mensajeIA
    });
  } catch (error) {
    console.error('Error en /api/chat:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/chat/:idConversacion - Obtener historial (opcional)
app.get('/api/chat/:idConversacion', async (req, res) => {
  try {
    const { idConversacion } = req.params;
    const conversacion = await Conversacion.findOne({ idConversacion });

    if (!conversacion) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    res.json({
      idConversacion,
      mensajes: conversacion.mensajes
    });
  } catch (error) {
    console.error('Error en /api/chat/:idConversacion:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Iniciar servidor
app.listen(PUERTO, () => {
  console.log(`Servidor ejecutándose en el puerto ${PUERTO}`);
});
