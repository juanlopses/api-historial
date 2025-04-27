const express = require('express');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(express.json());

const PUERTO = process.env.PORT || 3000;
const ARCHIVO_CONVERSACIONES = 'conversaciones.json';

// ==================================================
// CLAVE DE LA API DE CHUTES AI
// Reemplaza 'tu_clave_api_chutes_aqui' con tu clave real de Chutes AI
const CLAVE_API_CHUTES = 'cpk_18fba748a1134d63be05eeacd5248cef.55bc34ef087a520ea54f87e1a2af4553.4JchmGF7ZnlzYVF83s7BNaegO7kMdbfm';
// ==================================================

// Inicializar archivo JSON si no existe
if (!fs.existsSync(ARCHIVO_CONVERSACIONES)) {
  fs.writeFileSync(ARCHIVO_CONVERSACIONES, JSON.stringify({ conversaciones: {} }, null, 2));
}

// Leer conversaciones desde el archivo JSON
function leerConversaciones() {
  const datos = fs.readFileSync(ARCHIVO_CONVERSACIONES, 'utf8');
  return JSON.parse(datos);
}

// Guardar conversaciones en el archivo JSON
function guardarConversaciones(conversaciones) {
  fs.writeFileSync(ARCHIVO_CONVERSACIONES, JSON.stringify(conversaciones, null, 2));
}

// GET / - Página principal con mensaje
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Activa</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background-color: #f0f0f0;
        }
        h1 {
          color: #333;
          text-align: center;
          font-size: 2.5em;
        }
      </style>
    </head>
    <body>
      <h1>API activa para dani xd by kenn (esto es pa k la api no perda el historial XD</h1>
    </body>
    </html>
  `);
});

// POST /api/chat - Procesar mensaje de WhatsApp
app.post('/api/chat', async (req, res) => {
  try {
    const { mensaje, numeroTelefono } = req.body;

    if (!mensaje || !numeroTelefono) {
      return res.status(400).json({ error: 'Mensaje y número de teléfono son obligatorios' });
    }

    // Leer conversaciones
    const datos = leerConversaciones();
    let mensajes = datos.conversaciones[numeroTelefono] || [];

    // Agregar mensaje del usuario
    mensajes.push({
      rol: 'usuario',
      contenido: mensaje,
      fecha: new Date().toISOString()
    });

    // Preparar mensajes para la API de Chutes con instrucción inicial
    const mensajesApi = [
      {
        role: 'system',
        content: 'Eres un asistente que mantiene el historial de la conversación. Puedes responder preguntas sobre lo que el usuario preguntó anteriormente, usando las marcas de tiempo de los mensajes para dar contexto temporal. Responde de manera natural y precisa.'
      },
      ...mensajes.map(msg => ({
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
          'Authorization': `Bearer ${CLAVE_API_CHUTES}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const mensajeIA = respuesta.data.choices[0].message.content;

    // Agregar respuesta de la IA
    mensajes.push({
      rol: 'asistente',
      contenido: mensajeIA,
      fecha: new Date().toISOString()
    });

    // Actualizar conversaciones
    datos.conversaciones[numeroTelefono] = mensajes;
    guardarConversaciones(datos);

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
app.get('/api/chat/:idConversacion', (req, res) => {
  try {
    const { idConversacion } = req.params;
    const datos = leerConversaciones();
    const mensajes = datos.conversaciones[idConversacion];

    if (!mensajes) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    res.json({
      idConversacion,
      mensajes
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
