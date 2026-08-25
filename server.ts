import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Initialize Gemini SDK with User-Agent header for telemetry
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // Helper to generate content with ultra-fast streaming/model selection
  const generateWithModelFallback = async (ai: GoogleGenAI, prompt: string, preferredModel = 'gemini-3.1-flash-lite'): Promise<string> => {
    // Put fast flash-lite first for rapid conversational queries
    const modelsToTry = [preferredModel, 'gemini-3.7-flash', 'gemini-flash-latest'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} temporary issue (${err?.status || err?.message}), trying fallback model...`);
      }
    }

    throw lastError || new Error('All model attempts failed');
  };

  // API endpoint: Optimize & Suggest Technical Specification
  app.post('/api/gemini/optimize-spec', async (req, res) => {
    try {
      const { specText, equipmentName, brand, model } = req.body;
      if (!specText || typeof specText !== 'string') {
        return res.status(400).json({ error: 'specText is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(200).json({
          fallback: true,
          message: 'Server Gemini client not configured, using local rule-based optimizer',
        });
      }

      const prompt = `Eres un Ingeniero Biomédico experto en contratación pública hospitalaria (SECOP II) y estructuración de pliegos técnicos de equipos médicos en Colombia para SYD Colombia.
Tu tarea es analizar, corregir y profesionalizar la siguiente especificación técnica ingresada por el usuario.

Contexto del Equipo:
- Equipo: ${equipmentName || 'Equipo Biomédico Hospitalario'}
- Marca: ${brand || 'No especificada'}
- Modelo: ${model || 'No especificado'}

Texto original ingresado por el usuario:
"${specText}"

Instrucciones:
1. Corrige ortografía, sintaxis y unidades de medida (ej: mmHg, cmH2O, lpm/bpm, Hz, Joules, L/min, MHz, Watts, ml, °C, kg, cm, mm, pulgadas, etc.).
2. REGLA ESTRICTA DE DETECCIÓN DE PARÁMETROS NUMÉRICOS (isParametricSpec):
   - Solo se considera parámetro con rango si el texto CONTIENE PARÁMETROS FÍSICOS CONTINUOS MEDIBLES con unidades de ingeniería biomédica (ej: "pantalla 12.1 pulgadas", "frecuencia 50 a 100 lpm", "altura 60 cm", "presion 120/80 mmHg", "volumen 1500 ml", "batería 4 horas", "energía 360 Joules", "potencia 300 Watts", etc.).
   - PROHIBIDO GENERAR RANGO PARA ESTÁNDARES, PROTOCOLOS, ALGORITMOS O CONTEOS DISCRETOS:
     * Textos que mencionen HL7, DICOM, IEC 60601, ISO 13485, IPX1, USB, RS232, Wi-Fi, VGA, HDMI, etc. NO son rangos numéricos.
     * Textos como "más de 20 tipos de arritmias", "análisis del segmento ST", "hasta 8 curvas simultáneas", "cable de 3 a 5 derivadas", "12 derivaciones", "software en español", "registro INVIMA", etc. son ESPECIFICACIONES CUALITATIVAS / DE FUNCIONALIDAD, NO parámetros con rangos.
     * En todos estos casos debes responder obligatoriamente: "isParametricSpec": false, "paramName": null, "detectedWorkRange": null, "rangeVersion": null, "rangeVariants": null.
   - SI CONTIENE PARÁMETROS FÍSICOS MEDIBLES REALES:
     * "isParametricSpec": true
     * "paramName": Nombre del parámetro (ej: "Tamaño de Pantalla", "Frecuencia Cardíaca", "Cambio de Altura / Elevación", "Presión Arterial NIBP", "Medidas y Dimensiones", "Volumen Corriente", "Autonomía de Batería", etc.)
     * REGLA CRÍTICA DE RANGOS AMPLIOS: Los rangos de valores deben ser holgados, amplios y comercialmente realistas para pliegos de licitación, NUNCA rangos estrechos o milimétricos (como "12 a 12.2" o "12.0 a 12.2" que restringen indebidamente la licitación):
       - Pantallas: Si el valor original es ~12.1", el rango debe ser AMPLIO, ej: "10 a 12.1 pulgadas" o "10 a 13 pulgadas" (NUNCA 12 a 12.2). Si es 15", "12 a 15 pulgadas" o "12 a 17 pulgadas". Si es 8.4" o 7", "7 a 10.4 pulgadas".
       - Baterías: Para 4 horas -> "2 a 5 horas" o "mínimo 3 horas".
       - Frecuencia cardíaca: "15 a 300 lpm".
       - Presión NIBP: "10 a 270 mmHg".
       - Volumen Corriente (Vt): "10 a 1500 ml" o "20 a 1200 ml".
       - Flujo de gases: "0.1 a 15 L/min".
       - Energía desfibrilador: "1 a 360 Joules".
       - Potencia electrobisturí: "10 a 300 Watts".
       - Peso: Para equipo de 3.5 kg -> "2.5 a 4.5 kg".
     * "detectedWorkRange": Formular SIEMPRE como un INTERVALO/RANGO de valores amplio (ej: "10 a 12.1 pulgadas", "10 a 13 pulgadas", "15 a 300 lpm", "10 a 270 mmHg", "2 a 5 horas"). NO uses frases unilaterales como "no inferior a" en el campo de rango.
     * "rangeVersion": Redacción técnica formal que incorpore explícitamente el rango de valores de tipo "entre [Min] a [Max] [Unidad]" (ej: "Pantalla médica táctil a color con visualización diagonal entre 10 a 12.1 pulgadas de alta definición con curvas simultáneas...", "Rango de trabajo de frecuencia cardíaca continuo entre 15 a 300 lpm con resolución de 1 lpm...").
     * "rangeVariants": Objeto con 4 variantes: "between" (entre Min a Max amplio), "min" (mínimo Min hasta Max), "max" (máximo hasta Max), "fixed" (de [Valor] [Unidad] / valor nominal sin rangos).

3. Genera las 2 versiones de redacción:
   - "optimized": Versión técnica profesional mejorada y clara con rango "entre" amplio si es paramétrica.
   - "formal": Versión estrictamente formal para pliegos de contratación hospitalaria.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "optimized": "texto mejorado con rango entre amplio",
  "formal": "texto formal",
  "isParametricSpec": true,
  "paramName": "Tamaño de Pantalla",
  "detectedWorkRange": "10 a 12.1 pulgadas",
  "rangeVersion": "Pantalla médica táctil a color con tamaño diagonal entre 10 a 12.1 pulgadas con visualización de curvas simultáneas.",
  "rangeVariants": {
    "between": "Pantalla médica táctil a color con tamaño diagonal entre 10 a 12.1 pulgadas.",
    "min": "Pantalla médica táctil a color con tamaño diagonal mínimo 10 pulgadas.",
    "max": "Pantalla médica táctil a color con tamaño diagonal máximo hasta 13 pulgadas.",
    "fixed": "Pantalla médica táctil a color con tamaño diagonal de 12.1 pulgadas."
  }
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn('Gemini models temporarily unavailable, using graceful local fallback response:', geminiError);
        return res.status(200).json({
          fallback: true,
          message: 'Gemini service temporarily at capacity, switching to local biomedical engine',
        });
      }

      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.warn('Handling optimization request with local fallback:', err?.message || err);
      return res.status(200).json({
        fallback: true,
        message: err.message || 'Error processing AI technical specification',
      });
    }
  });

  // API endpoint: Generate complete AI Recommended Specifications & Ranges for an Equipment
  app.post('/api/gemini/generate-equipment-specs', async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body;
      if (!equipmentName) {
        return res.status(400).json({ error: 'equipmentName is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(200).json({
          fallback: true,
          message: 'Server Gemini client not configured, using local rule generator',
        });
      }

      const prompt = `Eres un Ingeniero Biomédico senior especialista en licitaciones hospitalarias en Colombia (SECOP II) y fichas técnicas médicas para la empresa SYD Colombia.
Analiza la tecnología médica del siguiente equipo:
- Nombre de Equipo: ${equipmentName}
- Marca: ${brand || 'SYD Colombia / Mindray / General'}
- Modelo: ${model || 'Estándar Hospitalario'}

Instrucciones de búsqueda y redacción:
1. Genera entre 6 y 9 especificaciones técnicas formales redactadas profesionalmente para pliego licitatorio.
2. REGLA ESTRICTA DE RANGOS AMPLIOS PARA ESPECIFICACIONES CON VALORES NUMÉRICOS:
   - Solo para especificaciones que involucren parámetros medibles o valores numéricos (ej: frecuencia cardíaca, NIBP, SpO2, temperatura, volumen tidal, presiones PEEP, flujo de gases medicinales, tamaño de pantalla, autonomía de batería, potencia en Watts, energía en Joules, tasa de infusión, etc.), debes indicar "hasWorkRange": true, y un "workRange" AMPLIO y HOLGADO.
   - NUNCA generes rangos estrechos, cerrados o milimétricos (como "12 a 12.2", "12.0 a 12.2" o "3.9 a 4.1").
   - Ejemplos de rangos amplios aprobados:
     * Tamaño de pantalla para equipo de ~12.1": workRange "10 a 12.1 pulgadas" o "10 a 13 pulgadas" (between: "Pantalla médica táctil a color con tamaño diagonal entre 10 a 12.1 pulgadas de alta definición...", fixed: "Pantalla médica táctil a color con tamaño diagonal de 12.1 pulgadas").
     * Tamaño de pantalla para equipo de 15": "12 a 15 pulgadas" o "12 a 17 pulgadas".
     * Frecuencia cardíaca: "15 a 300 lpm" (between: "Rango de medición y trabajo de frecuencia cardíaca continuo entre 15 a 300 lpm con resolución de 1 lpm...").
     * Presión no invasiva NIBP: "10 a 270 mmHg".
     * Saturación SpO2: "0 a 100%".
     * Temperatura: "0.0 a 50.0 °C".
     * Batería: "2 a 5 horas" o "mínimo 3 horas".
     * Volumen corriente Vt: "10 a 1500 ml" o "20 a 1200 ml".
     * Suministro de gases: "0.1 a 15 L/min".
     * Energía de desfibrilación: "1 a 360 Joules".
     * Potencia electrobisturí: "10 a 300 Watts".
   - Variantes de redacción a generar en cada especificación numérica:
     * "between": redacción con rango amplio "entre [min] a [max] [unidad]"
     * "min": redacción con exigencia de mínimo "mínimo [min] [unidad] hasta [max] [unidad]"
     * "max": redacción con límite superior "máximo hasta [max] [unidad]"
     * "fixed": redacción con valor nominal definido "de [max] [unit]" (sin rangos)
3. PARA ESPECIFICACIONES CUALITATIVAS, DE SOFTWARE, ALGORITMOS O ESTÁNDARES:
   - Casos como compatibilidad HL7/DICOM, análisis de arritmias (ej: detección de 20 o 24 tipos de arritmias), análisis del segmento ST, visualización de hasta 8 curvas, cables de 3 o 5 derivadas, 12 derivaciones, software en español, alarmas según IEC 60601, grado de protección IPX, manuales de usuario y certificaciones:
   - Deben tener OBLIGATORIAMENTE "hasWorkRange": false, "workRange": null y sin variantes numéricas ni rangos artificiales.
4. Formula 1 o 2 especificaciones como "isUnique": true (blindaje o característica de alta tecnología diferencial).
5. Sugiere una lista de 4 a 6 "optionalAccessories" ESPECÍFICOS que sean adicionales u opcionales que NO siempre vienen de fábrica (ej: Carrito de transporte rodable con frenos, Brazo o soporte de pared articulado, Módulo adicional de capnografía EtCO2, Módulo de presión invasiva IBP, Transductor adicional, Impresora térmica incorporada, Batería adicional de respaldo, etc.).

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta:
{
  "specs": [
    {
      "requirement": "Pantalla médica táctil LED a color de alta definición con tamaño diagonal entre 10 a 12.1 pulgadas con visualización de hasta 8 curvas simultáneas.",
      "isUnique": false,
      "hasWorkRange": true,
      "workRange": "10 a 12.1 pulgadas",
      "rangeVariants": {
        "between": "Pantalla médica táctil a color con visualización diagonal entre 10 a 12.1 pulgadas.",
        "min": "Pantalla médica táctil a color con visualización diagonal mínimo de 10 pulgadas.",
        "max": "Pantalla médica táctil a color con visualización diagonal hasta 13 pulgadas.",
        "fixed": "Pantalla médica táctil a color con visualización diagonal de 12.1 pulgadas."
      }
    },
    {
      "requirement": "Rango de trabajo de medición continua de frecuencia cardíaca de 15 a 300 lpm con resolución de 1 lpm y alarmas programables.",
      "isUnique": false,
      "hasWorkRange": true,
      "workRange": "15 a 300 lpm",
      "rangeVariants": {
        "between": "Rango de trabajo de frecuencia cardíaca continuo entre 15 a 300 lpm con resolución de 1 lpm.",
        "min": "Capacidad de frecuencia cardíaca de mínimo 15 lpm hasta 300 lpm con alarmas programables.",
        "max": "Frecuencia cardíaca con límite superior de máximo hasta 300 lpm.",
        "fixed": "Medición de frecuencia cardíaca continua con capacidad nominal de 300 lpm."
      }
    },
    {
      "requirement": "Interconectividad con sistema de información hospitalaria (HIS/RIS) y central de monitoreo mediante protocolo estándar HL7 y DICOM.",
      "isUnique": false,
      "hasWorkRange": false,
      "workRange": null
    }
  ],
  "optionalAccessories": [
    "Carrito de transporte rodable con frenos y bandeja porta-accesorios",
    "Brazo articulado de soporte a pared con giro de 180°",
    "Módulo adicional de Capnografía (EtCO2 microstream)",
    "Módulo de Presión Invasiva (IBP) de 2 canales",
    "Impresora / Registrador térmico incorporado de 3 canales",
    "Batería adicional de Iones de Litio de larga duración"
  ]
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn('Gemini models unavailable for equipment specs, using graceful local fallback:', geminiError);
        return res.status(200).json({
          fallback: true,
          message: 'Gemini service temporarily at capacity, switching to local rules',
        });
      }

      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.warn('Handling equipment specs request with fallback:', err?.message || err);
      return res.status(200).json({
        fallback: true,
        message: err.message || 'Error generating specs',
      });
    }
  });

  // API endpoint: Fetch automatic brief commercial/technical description from Internet / Gemini
  app.post('/api/gemini/equipment-description', async (req, res) => {
    try {
      const { equipmentName, brand, model } = req.body;
      if (!equipmentName || typeof equipmentName !== 'string' || equipmentName.trim().length < 3) {
        return res.json({ found: false, description: '' });
      }

      // Check if the input looks like nonsense / gibberish (e.g. "ajjaja", "sadsdasad", "123", "asdasd")
      const trimmed = equipmentName.trim();
      const isRepeatedOrJunk = /^([a-zA-Z])\1{2,}$/i.test(trimmed) || /^(asdf|jaja|test|prueba|1234|qwerty)/i.test(trimmed);
      if (isRepeatedOrJunk) {
        return res.json({ found: false, description: '' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json({ found: false, description: '' });
      }

      const prompt = `Eres un Ingeniero Biomédico y especialista en catálogo de dispositivos médicos para SYD Colombia.
Analiza la siguiente información ingresada:
- Nombre: "${trimmed}"
- Marca: "${brand || ''}"
- Modelo: "${model || ''}"

Instrucciones:
1. Evalúa si el texto corresponde a un equipo médico, dispositivo clínico, instrumental o tecnología hospitalaria REAL (por ejemplo: monitores de signos vitales, electrocardiógrafos, electrobisturís, desfibriladores, ecógrafos, ventiladores mecánicos, bombas de infusión, lámparas cialíticas, mesas quirúrgicas, etc.).
2. Si ES un equipo médico reconocible:
   - "found": true
   - "description": Redacta una descripción comercial y técnica breve, profesional y precisa (1 o máximo 2 oraciones, no más de 170 caracteres), destacando su aplicación clínica principal y tecnología destacada.
3. Si NO es un equipo médico, o si el texto es texto de prueba, letras al azar (ej: "ajjaja", "sadsdasad", "zzz"), o no existe certeza clínica de qué es:
   - "found": false
   - "description": "" (cadena totalmente vacía).

Devuelve EXCLUSIVAMENTE un objeto JSON válido:
{
  "found": true,
  "description": "Monitor multiparámetro de alta precisión para visualización continua de signos vitales en áreas de hospitalización y cuidados críticos."
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn('Gemini models unavailable for description lookup:', geminiError);
        return res.json({ found: false, description: '' });
      }

      const parsedData = JSON.parse(responseText);
      return res.json({
        found: Boolean(parsedData.found && parsedData.description && parsedData.description.trim() !== ''),
        description: parsedData.found ? (parsedData.description || '').trim() : '',
      });
    } catch (err: any) {
      console.warn('Error during equipment description lookup:', err?.message || err);
      return res.json({ found: false, description: '' });
    }
  });

  // API endpoint: Extract Tender Contract Data from Image / Photo (OCR with Gemini Vision)
  app.post('/api/gemini/extract-contract-from-image', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini AI no está configurado en el servidor',
        });
      }

      let cleanBase64 = imageBase64.trim();
      let detectedMime = mimeType || 'image/jpeg';
      if (cleanBase64.includes(';base64,')) {
        const parts = cleanBase64.split(';base64,');
        const mimeMatch = parts[0].match(/data:(.*?);/);
        if (mimeMatch) {
          detectedMime = mimeMatch[1].trim();
        }
        cleanBase64 = parts[1].trim();
      }
      // Remove any extraneous newlines or whitespaces in base64 string
      cleanBase64 = cleanBase64.replace(/\s+/g, '');

      const prompt = `Eres un Asistente Experto en Contratación Pública en Colombia (SECOP I, SECOP II, pliegos de condiciones, contratos hospitalarios, resoluciones, órdenes de compra y licitaciones médicas) para SYD Colombia.
Analiza con máxima precisión la imagen, fotografía, escaneo o captura de pantalla del documento adjunto (pliego de condiciones, resumen de licitación, acta de inicio, carátula contractual, extracto de SECOP II, invitación o carta de solicitud).

Tu tarea es leer y extraer con máxima precisión todos los datos que correspondan al contrato o licitación:

Campos a extraer:
1. clientName: Nombre oficial y completo de la Entidad contratante / Hospital / IPS / Clínica / E.S.E. / Secretaría de Salud / Alcaldía / Gobernación (ej: "Hospital Universitario San Ignacio", "Subred Integrada de Servicios de Salud Centro Oriente E.S.E.", "Hospital Departamental de Nariño", etc.).
2. nit: NIT de la entidad con o sin dígito de verificación (ej: "860.012.345-1"). Si no es legible o no aparece, deja "".
3. processNumber: Número de proceso, radicado de convocatoria, número de contrato o código del pliego (ej: "LP-2026-045", "SAM-012-2026", "CD-089-2025", "CO-1234").
4. budgetCOP: Valor total del contrato, cuantía o presupuesto oficial expresado ÚNICAMENTE como número entero en pesos colombianos (COP). Por ejemplo, si en el documento dice "$ 280.000.000 COP", "$280.000.000,00", o "DOSCIENTOS OCHENTA MILLONES DE PESOS", devuelve 280000000. Si no aparece o no se especifica, devuelve 0.
5. city: Ciudad o municipio donde se ejecuta el contrato o sede de la entidad (ej: "Bogotá D.C.", "Medellín", "Cali", "Barranquilla", "Pasto", etc.). Si no aparece, usa "Bogotá D.C.".
6. processType: Modalidad de contratación exacta o deducida. Debe ser EXACTAMENTE uno de los siguientes valores:
   - "Licitación Pública"
   - "Selección Abreviada"
   - "Convocatoria Privada"
   - "Contratación Directa"
   - "Subasta Inversa Electrónica"
   (Si no está explícito, usa "Licitación Pública").
7. contractObject: Objeto del contrato o descripción detallada de lo que se va a contratar o suministrar (ej: "Adquisición, instalación, pruebas y puesta en funcionamiento de equipos biomédicos hospitalarios...").
8. executionTerm: Tiempo o plazo de ejecución contractual (ej: "30 días calendario", "60 días hábiles", "6 meses", "Hasta el 31 de diciembre de 2026", etc.). Si no aparece, deja "".
9. contactPerson: Nombre de la persona de contacto, ordenador del gasto, interventor o funcionario responsable si aparece (ej: "Dr. Roberto Méndez"). Si no aparece, deja "".
10. openingDate: Fecha de apertura o publicación si aparece (en formato YYYY-MM-DD). Si no aparece, deja "".
11. closingDate: Fecha de cierre, presentación de ofertas o entrega si aparece (en formato YYYY-MM-DD). Si no aparece, deja "".
12. status: Estado del proyecto ("En Preparación", "Presentada", "Adjudicada"). Si el documento indica que el contrato fue adjudicado, firmado, es un acta de adjudicación o contrato perfeccionado, usa "Adjudicada". Si es un borrador o aviso de convocatoria, usa "En Preparación".

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "clientName": "Nombre de la Entidad",
  "nit": "860.000.000-1",
  "processNumber": "LP-2026-001",
  "budgetCOP": 280000000,
  "city": "Bogotá D.C.",
  "processType": "Licitación Pública",
  "contractObject": "Objeto del contrato...",
  "executionTerm": "60 días calendario",
  "contactPerson": "Dr. Nombre Apellido",
  "openingDate": "",
  "closingDate": "",
  "status": "En Preparación"
}`;

      const modelsToTry = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let lastError: any = null;
      let responseText = '';

      for (const modelName of modelsToTry) {
        try {
          const config: any = {
            responseMimeType: 'application/json',
            temperature: 0.1,
          };
          if (modelName === 'gemini-3.7-flash' || modelName.includes('3.7')) {
            config.thinkingConfig = { thinkingBudget: 0 };
          }
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: detectedMime,
                },
              },
              {
                text: prompt,
              },
            ],
            config,
          });

          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Model ${modelName} error on OCR contract image:`, err?.status || err?.message);
        }
      }

      if (!responseText) {
        throw lastError || new Error('No se pudo extraer texto de la imagen');
      }

      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }

      const parsedData = JSON.parse(cleanJson);
      if (parsedData.budgetCOP !== undefined) {
        parsedData.budgetCOP = Number(parsedData.budgetCOP) || 0;
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Error extracting contract from image:', err);
      return res.status(500).json({
        error: err.message || 'Error al procesar la imagen del contrato',
      });
    }
  });

  // API endpoint: Interactive SYD Biomedical & App Assistant Chat
  app.post('/api/gemini/chat-assistant', async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          reply:
            '¡Hola! Soy **Mara**, tu Asistente Biomédica y Copiloto de Inteligencia Artificial en SYD Colombia. Puedo aconsejarte y guiarte paso a paso sobre cómo cotizar, calcular costos y márgenes (L1 a L8), hacer seguimiento a Órdenes de Compra (OC), gestionar proveedores o estructurar pliegos para SECOP II.',
          actions: [
            { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
            { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
            { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
            { label: 'Gestor de Costos & TRM', type: 'navigate', tab: 'costos' },
            { label: 'Licitaciones SECOP II', type: 'navigate', tab: 'licitaciones' },
          ],
        });
      }

      // Format previous conversation context if available
      let historyText = '';
      if (Array.isArray(history) && history.length > 0) {
        historyText = history
          .slice(-6)
          .map((h: { sender: string; text: string }) => `${h.sender === 'user' ? 'Usuario' : 'Mara'}: ${h.text}`)
          .join('\n');
      }

      const prompt = `Eres "Mara", la Asistente Inteligente de Inteligencia Artificial oficial de SYD Colombia (empresa líder en comercialización, importación e ingeniería biomédica de tecnología hospitalaria en Colombia).

TU PERSONALIDAD Y FORMA DE RESPONDER:
- Eres sumamente inteligente, clara, amable, estructurada, ejecutiva y especialista en ingeniería biomédica y compras hospitalarias.
- Cuando el usuario te pregunte cómo hacer algo en la plataforma, sobre un equipo, sobre proveedores, cálculos o temas biomédicos:
  1. Aconséjale qué es lo más conveniente y seguro según la normatividad colombiana (INVIMA, TRM, cobertura de margen, pliegos SECOP II, logística de importación).
  2. Dale las opciones y los pasos claros y fáciles de seguir (ej: "Paso 1: ..., Paso 2: ...").
  3. Provee SIEMPRE botones de acción ('actions') pertinentes para que el usuario pueda hacer clic y abrir la ventana o el modal exacto sin tener que buscarlo manualmente.
  4. Utiliza los datos del contexto dinámico en tiempo real para dar cifras exactas cuando corresponda (ej: cuántos equipos hay registrados, TRM actual, cotizaciones u OCs activas).

ARQUITECTURA COMPLETA DE MÓDULOS Y CAPACIDADES EN LA APP SYD COLOMBIA:
1. Módulo 'inicio' (Dashboard General & TRM):
   - Visión global de métricas del negocio, cotizaciones del mes, OCs en tránsito, TRM en tiempo real y TRM recomendada (+5%).
   - Botón acción: { "label": "Ir a Inicio", "type": "navigate", "tab": "inicio" }

2. Módulo 'ventas' (Cotizador Comercial Oficial):
   - Selección de equipos médicos del catálogo, accesorios base incluidos y accesorios opcionales.
   - Manejo de IVA (19% o 0% exento para dispositivos médicos específicos según estatuto tributario).
   - Márgenes de ganancia (L1: 15% hasta L8: 80% o factor libre) con cálculo de venta: Precio = Costo / (1 - %Margen).
   - Generación, previsualización e impresión de PDF formal con membrete corporativo, logos y firma.
   - Botones acción:
     * { "label": "Abrir Cotizador", "type": "navigate", "tab": "ventas", "primary": true }
     * { "label": "Nueva Cotización", "type": "modal", "modalAction": "new_quote" }
     * { "label": "Vista Previa / Imprimir PDF", "type": "modal", "modalAction": "print_preview" }

3. Módulo 'historial' (Historial de Cotizaciones):
   - Control de propuestas guardadas, estados (Borrador, Enviada, Aprobada, Rechazada, Facturada).
   - Carga de cotizaciones pasadas al cotizador o duplicación rápida para nuevos clientes.
   - Botón acción: { "label": "Ver Historial de Cotizaciones", "type": "navigate", "tab": "historial" }

4. Módulo 'costos' (Gestor de Costos & TRM Automatizada):
   - TRM Oficial del Banco de la República / Superfinanciera que se actualiza AUTOMÁTICAMENTE en segundo plano cada 2 horas.
   - TRM Recomendada (+5% de margen de seguridad para amortiguar la volatilidad cambiaria del dólar).
   - Matriz de costos de equipos y accesorios en COP y USD, márgenes L1 (15%), L2 (20%), L2.5 (25%), L3 (30%), L3.5 (35%), L4 (40%), L5 (50%), L6 (60%), L7 (70%), L8 (80%), techo de precios hospitalarios, personalizador de columnas visibles y exportación a Excel.
   - Botón acción: { "label": "Abrir Gestor de Costos & TRM", "type": "navigate", "tab": "costos" }

5. Módulo 'catalogo' (Catálogo de Equipos Médicos):
   - Base multimarca de dispositivos biomédicos (Mindray, Edan, Bovie, Philips, Zoll, GE, etc.).
   - Generación asistida por IA de descripciones técnicas, registros INVIMA con semáforo de vigencia y accesorios.
   - Botones acción:
     * { "label": "Ver Catálogo de Equipos", "type": "navigate", "tab": "catalogo" }
     * { "label": "Registrar Nuevo Equipo", "type": "modal", "modalAction": "new_equipment", "primary": true }

6. Módulo 'licitaciones' (Licitaciones & SECOP II):
   - Estructuración de proyectos por hospital/cliente, matriz de cumplimiento técnico ("Cumple / No Cumple / Folio").
   - Optimizador Biomédico de Especificaciones Técnicas con IA: Detecta parámetros medibles y genera RANGOS AMPLIOS y holgados (ej: "entre 10 a 12.1 pulgadas", "15 a 300 lpm", "10 a 270 mmHg", "2 a 5 horas", 4 variantes: between/min/max/fixed, blindajes isUnique).
   - Importador masivo de pliegos desde Excel (modo anexar o reemplazar) y exportación a Excel.
   - Botón acción: { "label": "Ir a Licitaciones SECOP II", "type": "navigate", "tab": "licitaciones" }

7. Módulo 'seguimiento_oc' (Seguimiento de Órdenes de Compra & Logística):
   - Trazabilidad integral de compras vinculadas a licitaciones adjudicadas o cotizaciones aprobadas.
   - 11 Estados logísticos: Borrador -> Emitida -> Confirmada por Proveedor -> En Fabricación -> En Tránsito -> En Aduana / Nacionalización -> Equipos en Bodega SYD -> En Ingreso Técnico -> Listo para Despacho -> Despachado al Cliente -> Entregado e Instalado -> Cerrado.
   - Alertas automáticas de 48 horas cuando un equipo lleva más de 48h en un estado crítico (como aduana o listo en fábrica).
   - Estados de pago: Anticipo 50%, Contado 100%, Crédito 30/60/90 días (Vigente / Pagado).
   - Botón acción: { "label": "Ir a Seguimiento de OC", "type": "navigate", "tab": "seguimiento_oc" }

8. Directorio de Proveedores y Fabricantes (dentro de Seguimiento de OC):
   - Gestión de proveedores aliados, marcas autorizadas, contactos, correos y condiciones de pago.
   - Al abrir, muestra la lista de proveedores a la izquierda sin tapar la vista.
   - El botón superior "Nuevo Proveedor" despliega el formulario al lado derecho en paralelo.
   - Al seleccionar un proveedor se muestra su ficha, la cual se puede quitar en cualquier momento pulsando "Quitar Ficha" o haciendo clic de nuevo sobre el proveedor.
   - Botón acción: { "label": "Abrir Directorio de Proveedores", "type": "modal", "modalAction": "manage_suppliers" }

9. Módulo 'documentacion' (Repositorio Técnico & INVIMA):
   - Fichas técnicas, registros sanitarios INVIMA, manuales de usuario/servicio y certificados de calidad con control de vencimiento.
   - Botones acción:
     * { "label": "Abrir Repositorio de Documentos", "type": "navigate", "tab": "documentacion" }
     * { "label": "Subir Ficha / Registro INVIMA", "type": "modal", "modalAction": "new_document", "primary": true }

10. Herramientas Globales & Atajos:
    - Cierre universal con tecla Escape (ESC): Cierra al instante cualquier modal, drawer o panel flotante.
    - Widget Flotante de Alertas: Alerta sobre cotizaciones por vencer, retrasos en OCs, pagos y registros INVIMA.
    - Chat Dual: Mara IA + Chat de Equipo interno en tiempo real (General y directos).
    - Administración de Usuarios & Roles RBAC: { "label": "Administrar Usuarios", "type": "modal", "modalAction": "user_management" }
    - Personalización Visual: { "label": "Personalizar Logo & Colores", "type": "modal", "modalAction": "customization" }

CONTEXTO DINÁMICO EN TIEMPO REAL DEL SISTEMA:
- Pestaña activa actual: ${context?.activeTab || 'inicio'}
- Usuario: ${context?.userName || 'Usuario'} (${context?.userRole || 'Miembro SYD'})
- Equipos en catálogo: ${context?.totalEquipments ?? 'Varios'}
- Cotizaciones guardadas: ${context?.totalQuotes ?? 'Varias'}
- Proyectos licitatorios: ${context?.totalTenderClients ?? 'Varios'}
- Órdenes de Compra (OC): ${context?.totalOCContracts ?? 'Varias'}
- Proveedores registrados: ${context?.totalSuppliers ?? 16}
- Documentos técnicos: ${context?.totalDocuments ?? 'Varios'}
- Alertas activas: ${context?.totalAlerts ?? 0}
- TRM Spot en vivo: $${context?.liveTRM ? Number(context.liveTRM).toLocaleString('es-CO') : '4.185'} COP
- TRM Recomendada (+5%): $${context?.recommendedTRM ? Number(context.recommendedTRM).toLocaleString('es-CO') : '4.400'} COP
- Módulos instalados: ${context?.installedModules ? JSON.stringify(context.installedModules) : 'Todos los módulos SYD'}

Historial reciente de la conversación:
${historyText || '(Inicio de conversación)'}

Mensaje del Usuario:
"${message}"

INSTRUCCIONES DE RESPUESTA:
- Preséntate o responde como "Mara".
- Responde de forma muy clara, agradable, profesional y ejecutiva.
- Explica los pasos de forma estructurada (Paso 1, Paso 2, etc.) y brinda siempre consejos biomédicos y comerciales acordes a la normativa colombiana.
- Proporciona entre 1 y 4 botones de acción ('actions') para que el usuario pueda ejecutarlas de inmediato.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura:
{
  "reply": "Hola, soy Mara. Para hacer esto te recomiendo lo siguiente:\\n\\n1. **Paso 1**: ...\\n2. **Paso 2**: ...\\n\\nPuedes pulsar los botones directos aquí abajo para comenzar.",
  "actions": [
    {
      "label": "Texto visible en el botón",
      "type": "navigate" | "modal" | "query",
      "tab": "ventas" | "costos" | "catalogo" | "licitaciones" | "seguimiento_oc" | "documentacion" | "historial" | "inicio",
      "modalAction": "new_equipment" | "new_document" | "new_quote" | "manage_suppliers" | "new_oc" | "alerts_widget" | "user_management" | "customization" | "print_preview",
      "queryPrompt": "¿Cómo calcular margen?",
      "primary": true
    }
  ]
}`;

      let responseText = '{}';
      try {
        responseText = await generateWithModelFallback(ai, prompt);
      } catch (geminiError) {
        console.warn('Gemini error for chat assistant:', geminiError);
        return res.json({
          reply:
            'Hola, soy Mara. Para gestionar tus procesos comerciales, compras y técnicos en SYD Colombia, tienes a tu disposición las siguientes opciones rápidas:',
          actions: [
            { label: 'Ir al Cotizador', type: 'navigate', tab: 'ventas', primary: true },
            { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
            { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
            { label: 'Gestor de Costos & TRM', type: 'navigate', tab: 'costos' },
            { label: 'Registrar Equipo', type: 'modal', modalAction: 'new_equipment' },
          ],
        });
      }

      const parsedData = JSON.parse(responseText);
      const actionsList = Array.isArray(parsedData.actions)
        ? parsedData.actions
        : parsedData.suggestedTab
          ? [{ label: parsedData.suggestedTabLabel || 'Ir a Ventana', type: 'navigate', tab: parsedData.suggestedTab, primary: true }]
          : [];

      return res.json({
        reply: parsedData.reply || '¿En qué más te puedo asesorar el día de hoy?',
        actions: actionsList,
      });
    } catch (err: any) {
      console.warn('Error in chat assistant:', err?.message || err);
      return res.json({
        reply:
          'Hola, soy Mara. Estoy aquí para aconsejarte y ayudarte a realizar cualquier acción en la plataforma SYD Colombia. ¿Qué deseas hacer a continuación?',
        actions: [
          { label: 'Crear Cotización', type: 'navigate', tab: 'ventas', primary: true },
          { label: 'Seguimiento de OC', type: 'navigate', tab: 'seguimiento_oc' },
          { label: 'Directorio de Proveedores', type: 'modal', modalAction: 'manage_suppliers' },
          { label: 'Registrar Equipo', type: 'modal', modalAction: 'new_equipment' },
          { label: 'Gestor de Costos', type: 'navigate', tab: 'costos' },
        ],
      });
    }
  });

  // Live TRM (Tasa Representativa del Mercado) from official Superfinanciera / Datos Abiertos & exchange rates
  app.get('/api/trm', async (req, res) => {
    try {
      // 1. Primary: Official Colombian Open Data (Superintendencia Financiera de Colombia TRM)
      try {
        const socrataRes = await fetch('https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC', {
          headers: { Accept: 'application/json' },
        });
        if (socrataRes.ok) {
          const socrataData = await socrataRes.json();
          if (Array.isArray(socrataData) && socrataData.length > 0 && socrataData[0]?.valor) {
            const rawVal = parseFloat(socrataData[0].valor);
            if (!isNaN(rawVal) && rawVal > 1000 && rawVal < 10000) {
              const vigenciaDesde = socrataData[0].vigenciadesde;
              const vigenciaHasta = socrataData[0].vigenciahasta;
              const dateFormatted = vigenciaHasta
                ? new Date(vigenciaHasta).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
                : new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });

              return res.json({
                rate: Math.round(rawVal * 100) / 100,
                date: dateFormatted,
                vigenciaDesde,
                vigenciaHasta,
                source: 'Superintendencia Financiera de Colombia (Oficial)',
                isLive: true,
                lastUpdated: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Superfinanciera TRM fetch error:', err?.message || err);
      }

      // 2. Secondary: Live exchange rate API
      try {
        const erRes = await fetch('https://open.er-api.com/v6/latest/USD');
        if (erRes.ok) {
          const erData = await erRes.json();
          const rate = erData?.rates?.COP;
          if (typeof rate === 'number' && rate > 1000 && rate < 10000) {
            return res.json({
              rate: Math.round(rate * 100) / 100,
              date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }),
              source: 'ExchangeRate Global en Vivo',
              isLive: true,
              lastUpdated: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }
      } catch (err: any) {
        console.warn('ExchangeRate TRM fallback error:', err?.message || err);
      }

      // 3. Fallback
      return res.json({
        rate: 3048.12,
        date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }),
        source: 'TRM Referencial Colombia',
        isLive: false,
        lastUpdated: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error: any) {
      console.error('TRM general error:', error);
      res.status(500).json({ error: 'Failed to fetch TRM' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API endpoint: Daily Automatic Backup Email Dispatch
  app.post('/api/backup/email', async (req, res) => {
    try {
      const { sendDailyBackupEmail } = await import('./src/services/backupEmailService.js');
      const backupData = req.body;
      const recipient = 'eljemb22@gmail.com';
      
      const result = await sendDailyBackupEmail(backupData, recipient);
      res.json(result);
    } catch (err: any) {
      console.error('Backup API error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Error processing backup' });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SYD Colombia server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
