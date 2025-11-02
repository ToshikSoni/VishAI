import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { AzureChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { AzureOpenAI } from "openai";

const sessionMemories = {};

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const mentalHealthDocsPath = path.join(
  projectRoot,
  "data/mental_health_resources"
); // Directory for mental health PDFs

const userDocsPath = path.join(projectRoot, "data/user_documents");
// Create user documents directory if it doesn't exist
if (!fs.existsSync(userDocsPath)) {
  fs.mkdirSync(userDocsPath, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, userDocsPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, DOC, and DOCX files are allowed'));
    }
  }
});

// Crisis keywords to detect emergency situations
const crisisKeywords = [
  "suicide",
  "kill myself",
  "end my life",
  "don't want to live",
  "self-harm",
  "hurt myself",
  "harming myself",
  "want to die",
  "better off dead",
  "no reason to live",
  "dying",
  "take my own life",
];

const chatModel = new AzureChatOpenAI({
  azureOpenAIApiKey: process.env.AZURE_INFERENCE_SDK_KEY,
  azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
  azureOpenAIApiDeploymentName: process.env.DEPLOYMENT_NAME,
  azureOpenAIApiVersion: "2024-08-01-preview",
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000, // 60 second timeout
  maxRetries: 2, // Retry twice on failure
});

// Initialize Azure OpenAI client for GPT-4 Audio
const audioClient = new AzureOpenAI({
  apiKey: process.env.AZURE_INFERENCE_SDK_KEY,
  endpoint: `https://${process.env.INSTANCE_NAME}.openai.azure.com/`,
  apiVersion: "2025-01-01-preview",
  deployment: process.env.DEPLOYMENT_NAME,
});

let mentalHealthTexts = {};
let mentalHealthChunks = {};
const CHUNK_SIZE = 800;

// Function to check if text contains crisis indicators
function containsCrisisLanguage(text) {
  const textLower = text.toLowerCase();
  return crisisKeywords.some((keyword) => textLower.includes(keyword));
}

async function loadMentalHealthPDFs() {
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(mentalHealthDocsPath)) {
      fs.mkdirSync(mentalHealthDocsPath, { recursive: true });
      console.log(`Created directory: ${mentalHealthDocsPath}`);
      return {};
    }

    const files = fs
      .readdirSync(mentalHealthDocsPath)
      .filter((file) => file.endsWith(".pdf"));
    console.log(
      `Found ${files.length} PDF files in mental health resources directory`
    );

    for (const file of files) {
      const filePath = path.join(mentalHealthDocsPath, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      mentalHealthTexts[file] = data.text;
      mentalHealthChunks[file] = [];

      let currentChunk = "";
      const words = data.text.split(/\s+/);

      for (const word of words) {
        if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
          currentChunk += (currentChunk ? " " : "") + word;
        } else {
          mentalHealthChunks[file].push(currentChunk);
          currentChunk = word;
        }
      }
      if (currentChunk) mentalHealthChunks[file].push(currentChunk);
    }

    return mentalHealthTexts;
  } catch (error) {
    console.error("Error loading mental health PDFs:", error);
    return {};
  }
}

// Initialize by loading PDFs
loadMentalHealthPDFs()
  .then(() => {
    console.log("Mental health resources loaded successfully");
  })
  .catch((err) => {
    console.error("Failed to load mental health resources:", err);
  });

function retrieveRelevantContent(query, includeUserDocs = true) {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 3)
    .map((term) => term.replace(/[.,?!;:()"']/g, ""));

  if (queryTerms.length === 0) return [];

  // Flatten all chunks from mental health documents
  const allChunksWithSources = [];
  Object.keys(mentalHealthChunks).forEach((fileName) => {
    mentalHealthChunks[fileName].forEach((chunk) => {
      allChunksWithSources.push({ chunk, source: `[Resource] ${fileName}` });
    });
  });

  // Add user documents if requested
  if (includeUserDocs) {
    try {
      const userFiles = fs.readdirSync(userDocsPath).filter(file => 
        file.endsWith('.pdf') || file.endsWith('.txt')
      );
      
      for (const file of userFiles) {
        const filePath = path.join(userDocsPath, file);
        const originalName = file.split('-').slice(2).join('-'); // Remove timestamp prefix
        
        if (file.endsWith('.pdf')) {
          try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = pdfParse(dataBuffer);
            const text = data.text;
            
            // Chunk the user document
            const chunks = [];
            let currentChunk = "";
            const words = text.split(/\s+/);
            
            for (const word of words) {
              if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
                currentChunk += (currentChunk ? " " : "") + word;
              } else {
                chunks.push(currentChunk);
                currentChunk = word;
              }
            }
            if (currentChunk) chunks.push(currentChunk);
            
            chunks.forEach(chunk => {
              allChunksWithSources.push({ chunk, source: `[Your Document] ${originalName}` });
            });
          } catch (err) {
            console.error(`Error reading user PDF ${file}:`, err);
          }
        } else if (file.endsWith('.txt')) {
          try {
            const text = fs.readFileSync(filePath, 'utf-8');
            
            // Chunk the text file
            const chunks = [];
            let currentChunk = "";
            const words = text.split(/\s+/);
            
            for (const word of words) {
              if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
                currentChunk += (currentChunk ? " " : "") + word;
              } else {
                chunks.push(currentChunk);
                currentChunk = word;
              }
            }
            if (currentChunk) chunks.push(currentChunk);
            
            chunks.forEach(chunk => {
              allChunksWithSources.push({ chunk, source: `[Your Document] ${originalName}` });
            });
          } catch (err) {
            console.error(`Error reading user TXT ${file}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Error loading user documents:', err);
    }
  }

  const scoredChunks = allChunksWithSources.map((item) => {
    const chunkLower = item.chunk.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      const regex = new RegExp(term, "gi");
      const matches = chunkLower.match(regex);
      if (matches) score += matches.length;
    }
    return { ...item, score };
  });

  return scoredChunks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      content: item.chunk,
      source: item.source,
    }));
}

function getSessionMemory(sessionId) {
  if (!sessionMemories[sessionId]) {
    const history = new ChatMessageHistory();
    sessionMemories[sessionId] = new BufferMemory({
      chatHistory: history,
      returnMessages: true,
      memoryKey: "chat_history",
    });
  }
  return sessionMemories[sessionId];
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const useRAG = req.body.useRAG === undefined ? true : req.body.useRAG;
  const sessionId = req.body.sessionId || "default";
  const rawMode =
    typeof req.body.mode === "string" ? req.body.mode.toLowerCase() : "chat";
  const talkMode = rawMode === "talk";
  const userInfo = req.body.userInfo || null;

  let sources = [];
  let isCrisis = containsCrisisLanguage(userMessage);

  const memory = getSessionMemory(sessionId);
  const memoryVars = await memory.loadMemoryVariables({});

  if (useRAG) {
    sources = retrieveRelevantContent(userMessage);
  }

  // Build user context string if user info is provided
  let userContext = '';
  if (userInfo) {
    userContext = '\n\n[User Information for Context]:\n';
    if (userInfo.name) userContext += `- Name: ${userInfo.name}\n`;
    if (userInfo.age) userContext += `- Age: ${userInfo.age}\n`;
    if (userInfo.gender) userContext += `- Gender: ${userInfo.gender}\n`;
    if (userInfo.pronouns) userContext += `- Preferred Pronouns: ${userInfo.pronouns}\n`;
    if (userInfo.occupationType === 'student') {
      userContext += '- Occupation: Student\n';
      if (userInfo.course) userContext += `- Course: ${userInfo.course}\n`;
      if (userInfo.branch) userContext += `- Branch/Specialization: ${userInfo.branch}\n`;
    } else if (userInfo.occupationType === 'working') {
      userContext += '- Occupation: Working Professional\n';
      if (userInfo.jobTitle) userContext += `- Job Title: ${userInfo.jobTitle}\n`;
      if (userInfo.organization) userContext += `- Organization: ${userInfo.organization}\n`;
    }
    if (userInfo.currentMood) {
      userContext += `- Current Emotional State: ${userInfo.currentMood}\n`;
    }
    if (userInfo.concerns) {
      userContext += `- Primary Concerns/Goals: ${userInfo.concerns}\n`;
    }
    if (userInfo.communicationStyle) {
      userContext += `- Preferred Communication Style: ${userInfo.communicationStyle}\n`;
    }
    if (userInfo.previousTherapy) {
      userContext += `- Therapy Experience: ${userInfo.previousTherapy}\n`;
    }
    if (userInfo.aboutMe) userContext += `- About: ${userInfo.aboutMe}\n`;
    userContext += '\nUse this information naturally and adapt your responses to their preferences. Be especially mindful of their emotional state and communication style. Use their preferred pronouns consistently.\n';
  }

  // Prepare system prompt with special handling for crisis situations
  let systemContent;
  const talkModeCue = talkMode
    ? `Respond as if you are speaking aloud. Keep replies warm, conversational, and concise (no more than three short sentences). Invite the person to continue sharing rather than delivering long monologues.`
    : "";

  if (isCrisis) {
    systemContent = `You are a compassionate mental health support assistant speaking to someone in crisis. 
This person may be having thoughts of suicide or self-harm based on their message. 
Your priority is their safety. Respond with empathy and care. 
Remind them that help is available and they're not alone.
Suggest contacting a crisis hotline (988 in the US) or emergency services if they are in immediate danger.
DO NOT downplay their feelings or use clichés like "it gets better" or "just think positive."
Acknowledge their pain while gently encouraging them to seek professional help.${userContext}`;
  } else if (useRAG && sources.length > 0) {
    const sourcesText = sources.map((s) => s.content).join("\n\n");
    systemContent = `You are a supportive and compassionate mental health assistant.
Use the information provided below to help answer the user's question with empathy and care.
Remember to always prioritize the person's wellbeing and never give harmful advice.

--- MENTAL HEALTH RESOURCES ---
${sourcesText}
--- END OF RESOURCES ---${userContext}`;
  } else {
    systemContent = `You are a supportive and compassionate mental health assistant. 
Your goal is to provide a safe space for people to discuss their mental health concerns.
Respond with empathy, validation, and understanding.
Never give medical advice; instead, encourage seeking professional help when appropriate.
If you don't know something, it's better to acknowledge that than to provide potentially harmful information.
Always prioritize the person's wellbeing in your responses.${userContext}`;
  }

  if (talkModeCue) {
    systemContent = `${systemContent}\n\n${talkModeCue}`;
  }

  const systemMessage = {
    role: "system",
    content: systemContent,
  };

  try {
    // Build final messages array with proper role mapping
    const messages = [
      systemMessage,
      ...(memoryVars.chat_history || []).map(msg => {
        let role = msg._getType ? msg._getType() : msg.role;
        // Fix LangChain role names to OpenAI API format
        if (role === 'human') role = 'user';
        if (role === 'ai') role = 'assistant';
        return {
          role: role,
          content: msg.content
        };
      }),
      { role: "user", content: userMessage },
    ];

    console.log(`📝 Chat context for session ${sessionId}:`, messages.length, 'messages');

    // Use OpenAI client for text-only mode (gpt-audio requires modalities even for text)
    const completion = await audioClient.chat.completions.create({
      model: process.env.DEPLOYMENT_NAME,
      messages: messages,
      max_tokens: 4096,
      temperature: 0.7,
      modalities: ["text", "audio"],
      audio: { 
        voice: "sage",
        format: "mp3" 
      },
    });

    // Extract text from either content or audio.transcript
    const message = completion.choices[0]?.message;
    const responseText = message?.content || message?.audio?.transcript || "";

    console.log(`📝 Text chat response - Text length: ${responseText.length}`);

    await memory.saveContext(
      { input: userMessage },
      { output: responseText }
    );

    res.json({
      reply: responseText,
      sources: sources.map((s) => s.content),
      isCrisis: isCrisis,
      resources: isCrisis
        ? [
            { name: "National Suicide Prevention Lifeline", contact: "988" },
            { name: "Crisis Text Line", contact: "Text HOME to 741741" },
            {
              name: "International Association for Suicide Prevention",
              url: "https://www.iasp.info/resources/Crisis_Centres/",
            },
          ]
        : [],
    });
  } catch (err) {
    console.error('Error in /chat endpoint:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      status: err.status,
      code: err.code
    });

    // Handle content filter errors specifically
    if (err.code === 'content_filter' || err.status === 400) {
      // Still provide crisis support even when content is filtered
      const crisisResponse = isCrisis 
        ? "I can hear that you're going through a really difficult time right now. Your safety is what matters most. Please reach out to a crisis counselor who can provide immediate support:\n\n• Call or text **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n• Call **911** if you're in immediate danger\n\nThese services are free, confidential, and available 24/7. You don't have to face this alone."
        : "I'm here to support you, but I need to be careful with how I respond. If you're in crisis or having thoughts of self-harm, please contact:\n\n• **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n\nThey have trained counselors available 24/7 who can help.";

      return res.json({
        reply: crisisResponse,
        sources: [],
        isCrisis: isCrisis,
        resources: isCrisis ? [
          { name: "National Suicide Prevention Lifeline", contact: "988" },
          { name: "Crisis Text Line", contact: "Text HOME to 741741" },
          {
            name: "International Association for Suicide Prevention",
            url: "https://www.iasp.info/resources/Crisis_Centres/",
          },
        ] : [],
      });
    }

    res.status(500).json({
      error: "Model call failed",
      message: err.message,
      reply:
        "I'm sorry, I encountered a problem. If you're in crisis, please call 988 (US) or your local emergency number immediately.",
    });
  }
});

// Endpoint to upload user documents
app.post("/upload-document", upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileId = req.file.filename.split('-')[0] + '-' + req.file.filename.split('-')[1];
    
    res.json({
      success: true,
      id: fileId,
      name: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// Endpoint to delete user documents
app.delete("/delete-document/:id", async (req, res) => {
  try {
    const docId = req.params.id;
    const files = fs.readdirSync(userDocsPath);
    const fileToDelete = files.find(file => file.startsWith(docId));

    if (fileToDelete) {
      fs.unlinkSync(path.join(userDocsPath, fileToDelete));
      res.json({ success: true, message: "Document deleted successfully" });
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Endpoint to clear session memory
app.post("/clear-memory", (req, res) => {
  const sessionId = req.body.sessionId || "default";
  if (sessionMemories[sessionId]) {
    delete sessionMemories[sessionId];
    res.json({ success: true, message: "Memory cleared successfully" });
  } else {
    res.json({ success: true, message: "No memory found for this session" });
  }
});

// New endpoint for GPT-4 Audio chat
app.post("/chat-audio", async (req, res) => {
  const userMessage = req.body.message;
  const useRAG = req.body.useRAG === undefined ? true : req.body.useRAG;
  const sessionId = req.body.sessionId || "default";
  const userInfo = req.body.userInfo || null;

  let sources = [];
  let isCrisis = containsCrisisLanguage(userMessage);

  const memory = getSessionMemory(sessionId);
  const memoryVars = await memory.loadMemoryVariables({});

  if (useRAG) {
    sources = retrieveRelevantContent(userMessage);
  }

  // Build user context string if user info is provided
  let userContext = '';
  if (userInfo) {
    userContext = '\n\n[User Information for Context]:\n';
    if (userInfo.name) userContext += `- Name: ${userInfo.name}\n`;
    if (userInfo.age) userContext += `- Age: ${userInfo.age}\n`;
    if (userInfo.gender) userContext += `- Gender: ${userInfo.gender}\n`;
    if (userInfo.pronouns) userContext += `- Preferred Pronouns: ${userInfo.pronouns}\n`;
    if (userInfo.occupationType === 'student') {
      userContext += '- Occupation: Student\n';
      if (userInfo.course) userContext += `- Course: ${userInfo.course}\n`;
      if (userInfo.branch) userContext += `- Branch/Specialization: ${userInfo.branch}\n`;
    } else if (userInfo.occupationType === 'working') {
      userContext += '- Occupation: Working Professional\n';
      if (userInfo.jobTitle) userContext += `- Job Title: ${userInfo.jobTitle}\n`;
      if (userInfo.organization) userContext += `- Organization: ${userInfo.organization}\n`;
    }
    if (userInfo.currentMood) {
      userContext += `- Current Emotional State: ${userInfo.currentMood}\n`;
    }
    if (userInfo.concerns) {
      userContext += `- Primary Concerns/Goals: ${userInfo.concerns}\n`;
    }
    if (userInfo.communicationStyle) {
      userContext += `- Preferred Communication Style: ${userInfo.communicationStyle}\n`;
    }
    if (userInfo.previousTherapy) {
      userContext += `- Therapy Experience: ${userInfo.previousTherapy}\n`;
    }
    if (userInfo.aboutMe) userContext += `- About: ${userInfo.aboutMe}\n`;
    userContext += '\nUse this information naturally and adapt your responses to their preferences. Be especially mindful of their emotional state and communication style. Use their preferred pronouns consistently.\n';
  }

  // Prepare system prompt
  let systemContent;
  const audioInstruction = `You are speaking aloud in a warm, empathetic, and conversational tone. Keep responses natural and emotionally supportive, as if you're a caring friend having a voice conversation. Use the "Sage" voice style - calm, wise, and reassuring.`;

  if (isCrisis) {
    systemContent = `You are a compassionate mental health support assistant speaking to someone in crisis. 
This person may be having thoughts of suicide or self-harm based on their message. 
Your priority is their safety. Respond with empathy and care in a gentle, supportive voice.
Remind them that help is available and they're not alone.
Suggest contacting a crisis hotline (988 in the US) or emergency services if they are in immediate danger.
DO NOT downplay their feelings or use clichés like "it gets better" or "just think positive."
Acknowledge their pain while gently encouraging them to seek professional help.
${audioInstruction}${userContext}`;
  } else if (useRAG && sources.length > 0) {
    const sourcesText = sources.map((s) => s.content).join("\n\n");
    systemContent = `You are a supportive and compassionate mental health assistant.
Use the information provided below to help answer the user's question with empathy and care.
Remember to always prioritize the person's wellbeing and never give harmful advice.
${audioInstruction}

--- MENTAL HEALTH RESOURCES ---
${sourcesText}
--- END OF RESOURCES ---${userContext}`;
  } else {
    systemContent = `You are a supportive and compassionate mental health assistant. 
Your goal is to provide a safe space for people to discuss their mental health concerns.
Respond with empathy, validation, and understanding.
Never give medical advice; instead, encourage seeking professional help when appropriate.
${audioInstruction}${userContext}`;
  }

  // Build messages array for audio model with proper role mapping
  const messages = [
    { role: "system", content: systemContent },
    ...(memoryVars.chat_history || []).map(msg => {
      let role = msg._getType ? msg._getType() : msg.role;
      // Fix LangChain role names to OpenAI API format
      if (role === 'human') role = 'user';
      if (role === 'ai') role = 'assistant';
      return {
        role: role,
        content: msg.content
      };
    }),
    { role: "user", content: userMessage },
  ];

  console.log(`🎤 Audio chat context for session ${sessionId}:`, messages.length, 'messages');

  try {
    // Call GPT-4 Audio API with modalities
    const completion = await audioClient.chat.completions.create({
      model: process.env.DEPLOYMENT_NAME,
      messages: messages,
      max_tokens: 4096,
      temperature: 0.7,
      modalities: ["text", "audio"],
      audio: { 
        voice: "sage",
        format: "mp3" 
      },
    });

    // Debug: Log the full message structure
    const message = completion.choices[0]?.message;
    console.log('🔍 Message structure:', {
      hasContent: !!message?.content,
      contentLength: message?.content?.length || 0,
      hasAudio: !!message?.audio,
      hasAudioTranscript: !!message?.audio?.transcript,
      transcriptLength: message?.audio?.transcript?.length || 0,
      audioDataLength: message?.audio?.data?.length || 0
    });

    // GPT-audio returns text in either content or audio.transcript
    const responseText = message?.content || 
                        message?.audio?.transcript || 
                        "";
    const audioData = message?.audio?.data; // Base64 encoded audio

    console.log(`✅ Audio response - Text length: ${responseText.length}, Audio: ${audioData ? 'Yes' : 'No'}`);

    // Save to memory
    await memory.saveContext(
      { input: userMessage },
      { output: responseText }
    );

    res.json({
      reply: responseText,
      audioData: audioData, // Base64 encoded MP3
      sources: sources.map((s) => s.content),
      isCrisis: isCrisis,
      resources: isCrisis
        ? [
            { name: "National Suicide Prevention Lifeline", contact: "988" },
            { name: "Crisis Text Line", contact: "Text HOME to 741741" },
            {
              name: "International Association for Suicide Prevention",
              url: "https://www.iasp.info/resources/Crisis_Centres/",
            },
          ]
        : [],
    });
  } catch (err) {
    console.error('Error in /chat-audio endpoint:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      status: err.status,
      code: err.code
    });

    // Handle content filter errors
    if (err.code === 'content_filter' || err.status === 400) {
      const crisisResponse = isCrisis 
        ? "I can hear that you're going through a really difficult time right now. Your safety is what matters most. Please reach out to a crisis counselor who can provide immediate support:\n\n• Call or text **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n• Call **911** if you're in immediate danger\n\nThese services are free, confidential, and available 24/7. You don't have to face this alone."
        : "I'm here to support you, but I need to be careful with how I respond. If you're in crisis or having thoughts of self-harm, please contact:\n\n• **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n\nThey have trained counselors available 24/7 who can help.";

      return res.json({
        reply: crisisResponse,
        audioData: null,
        sources: [],
        isCrisis: isCrisis,
        resources: isCrisis ? [
          { name: "National Suicide Prevention Lifeline", contact: "988" },
          { name: "Crisis Text Line", contact: "Text HOME to 741741" },
          {
            name: "International Association for Suicide Prevention",
            url: "https://www.iasp.info/resources/Crisis_Centres/",
          },
        ] : [],
      });
    }

    res.status(500).json({
      error: "Audio model call failed",
      message: err.message,
      reply: "I'm sorry, I encountered a problem. If you're in crisis, please call 988 (US) or your local emergency number immediately.",
      audioData: null,
    });
  }
});

// Update the console log message
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Vish AI Friend Support Chatbot API running on port ${PORT}`);
});
