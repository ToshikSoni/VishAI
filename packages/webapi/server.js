import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pdfParse from "pdf-parse";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { AzureOpenAI } from "openai";
import { AgentOrchestrator } from "./agents/orchestrator.js";
import { MCPClient } from "./agents/mcp-client.js";

dotenv.config();

const sessionMemories = {};
const sessionOrchestrators = {};
const mcpClient = new MCPClient(process.env.MCP_SERVER_URL || "http://localhost:3001");
let mcpConnected = false;

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const mentalHealthDocsPath = path.join(projectRoot, "data/mental_health_resources");
const userDocsPath = path.join(projectRoot, "data/user_documents");

[mentalHealthDocsPath, userDocsPath].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, userDocsPath),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype =
      allowedTypes.test(file.mimetype) ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only PDF, TXT, DOC, and DOCX files are allowed"));
  },
});

const crisisKeywords = [
  "suicide", "kill myself", "end my life", "don't want to live",
  "self-harm", "hurt myself", "harming myself", "want to die",
  "better off dead", "no reason to live", "dying", "take my own life",
];

const textClient = new AzureOpenAI({
  apiKey: process.env.TEXT_API_KEY || process.env.AZURE_INFERENCE_SDK_KEY,
  endpoint: process.env.TEXT_ENDPOINT || `https://${process.env.INSTANCE_NAME}.openai.azure.com/`,
  apiVersion: process.env.TEXT_API_VERSION || "2025-04-01-preview",
  deployment: process.env.TEXT_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME,
});

const audioClient = new AzureOpenAI({
  apiKey: process.env.AUDIO_API_KEY || process.env.AZURE_INFERENCE_SDK_KEY,
  endpoint: process.env.AUDIO_ENDPOINT || `https://${process.env.INSTANCE_NAME}.openai.azure.com/`,
  apiVersion: "2025-01-01-preview",
  deployment: process.env.AUDIO_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME,
});

const CHUNK_SIZE = 800;
let mentalHealthChunks = {};

function containsCrisisLanguage(text) {
  const textLower = text.toLowerCase();
  return crisisKeywords.some((keyword) => textLower.includes(keyword));
}

function chunkText(text) {
  const chunks = [];
  let currentChunk = "";
  const words = text.split(/\s+/);
  for (const word of words) {
    if ((currentChunk + " " + word).length <= CHUNK_SIZE) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

async function loadMentalHealthPDFs() {
  try {
    const files = fs.readdirSync(mentalHealthDocsPath).filter((file) => file.endsWith(".pdf"));
    console.log(`Found ${files.length} PDF files in mental health resources directory`);
    for (const file of files) {
      const filePath = path.join(mentalHealthDocsPath, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      mentalHealthChunks[file] = chunkText(data.text);
    }
    console.log("Mental health resources loaded successfully");
  } catch (error) {
    console.error("Error loading mental health PDFs:", error);
  }
}

loadMentalHealthPDFs().catch((err) => {
  console.error("Failed to load mental health resources:", err);
});

async function retrieveRelevantContent(query, includeUserDocs = true) {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 3)
    .map((term) => term.replace(/[.,?!;:()"']/g, ""));

  if (queryTerms.length === 0) return [];

  const allChunksWithSources = [];

  Object.entries(mentalHealthChunks).forEach(([fileName, chunks]) => {
    chunks.forEach((chunk) => {
      allChunksWithSources.push({ chunk, source: `[Resource] ${fileName}` });
    });
  });

  if (includeUserDocs) {
    try {
      const userFiles = fs
        .readdirSync(userDocsPath)
        .filter((file) => file.endsWith(".pdf") || file.endsWith(".txt"));

      for (const file of userFiles) {
        const filePath = path.join(userDocsPath, file);
        const originalName = file.split("-").slice(2).join("-");
        try {
          let text;
          if (file.endsWith(".pdf")) {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            text = data.text;
          } else if (file.endsWith(".txt")) {
            text = fs.readFileSync(filePath, "utf-8");
          }
          if (text) {
            chunkText(text).forEach((chunk) => {
              allChunksWithSources.push({ chunk, source: `[Your Document] ${originalName}` });
            });
          }
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
        }
      }
    } catch (err) {
      console.error("Error loading user documents:", err);
    }
  }

  const scoredChunks = allChunksWithSources.map((item) => {
    const chunkLower = item.chunk.toLowerCase();
    let score = 0;
    queryTerms.forEach((term) => {
      const matches = chunkLower.match(new RegExp(term, "gi"));
      if (matches) score += matches.length;
    });
    return { ...item, score };
  });

  return scoredChunks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({ content: item.chunk, source: item.source }));
}

function getSessionMemory(sessionId) {
  if (!sessionMemories[sessionId]) {
    sessionMemories[sessionId] = new BufferMemory({
      chatHistory: new ChatMessageHistory(),
      returnMessages: true,
      memoryKey: "chat_history",
    });
  }
  return sessionMemories[sessionId];
}

function getSessionOrchestrator(sessionId) {
  if (!sessionOrchestrators[sessionId]) {
    sessionOrchestrators[sessionId] = new AgentOrchestrator(mcpConnected ? mcpClient : null);
  }
  return sessionOrchestrators[sessionId];
}

function buildMessages(systemContent, memoryVars, userMessage) {
  return [
    { role: "system", content: systemContent },
    ...(memoryVars.chat_history || []).map((msg) => {
      let role = msg._getType ? msg._getType() : msg.role;
      if (role === "human") role = "user";
      if (role === "ai") role = "assistant";
      return { role, content: msg.content };
    }),
    { role: "user", content: userMessage },
  ];
}

function getCrisisResources() {
  return [
    { name: "National Suicide Prevention Lifeline", contact: "988" },
    { name: "Crisis Text Line", contact: "Text HOME to 741741" },
    { name: "International Association for Suicide Prevention", url: "https://www.iasp.info/resources/Crisis_Centres/" },
  ];
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Vish AI API is running!",
    timestamp: new Date().toISOString(),
    endpoints: ["/chat", "/chat-audio", "/upload-document", "/delete-document/:id", "/clear-memory", "/health"],
  });
});

app.get("/health", (req, res) => {
  const hasEnvVars = !!(
    process.env.AZURE_INFERENCE_SDK_KEY &&
    process.env.INSTANCE_NAME &&
    process.env.DEPLOYMENT_NAME
  );
  res.json({
    status: hasEnvVars ? "healthy" : "unhealthy",
    environment: {
      hasApiKey: !!process.env.AZURE_INFERENCE_SDK_KEY,
      hasInstanceName: !!process.env.INSTANCE_NAME,
      hasDeploymentName: !!process.env.DEPLOYMENT_NAME,
    },
    timestamp: new Date().toISOString(),
  });
});

app.post("/chat", async (req, res) => {
  try {
    const {
      message: userMessage,
      useRAG = true,
      sessionId = "default",
      mode = "chat",
      userInfo = null,
    } = req.body;
    const talkMode = mode.toLowerCase() === "talk";

    const memory = getSessionMemory(sessionId);
    const orchestrator = getSessionOrchestrator(sessionId);
    const memoryVars = await memory.loadMemoryVariables({});

    const selectedAgent = await orchestrator.selectAgent(userMessage, sessionId);
    console.log(`Selected Agent: ${selectedAgent.name} (${selectedAgent.role})`);

    let systemContent = await orchestrator.getAgentSystemPrompt(selectedAgent, userInfo);

    if (mcpConnected) {
      systemContent += await orchestrator.getMCPContext(selectedAgent, userMessage);
    }

    const isCrisis = containsCrisisLanguage(userMessage);
    const sources = useRAG ? await retrieveRelevantContent(userMessage) : [];
    if (useRAG && sources.length > 0) {
      const sourcesText = sources.map((s) => s.content).join("\n\n");
      systemContent += `\n\n=== UPLOADED DOCUMENTS & MENTAL HEALTH RESOURCES ===\n${sourcesText}\n`;
    }

    if (talkMode) {
      systemContent += `\n\n=== VOICE MODE ===\nYou are currently in VOICE mode. Respond as if speaking aloud. Keep replies warm, conversational, and concise (no more than three short sentences). Invite the person to continue sharing rather than delivering long monologues.`;
    }

    const messages = buildMessages(systemContent, memoryVars, userMessage);

    const completion = await audioClient.chat.completions.create({
      model: process.env.AUDIO_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
      modalities: ["text", "audio"],
      audio: { voice: "marin", format: "mp3" },
    });

    const message = completion.choices[0]?.message;
    let responseText = "";
    
    if (message?.content) {
      responseText = message.content;
    } else if (message?.audio?.transcript) {
      responseText = message.audio.transcript;
    }
    
    const audioData = talkMode ? message?.audio?.data : undefined;
    const emotion = orchestrator.getAgentEmotion();
    const agentMetadata = orchestrator.getAgentMetadata();

    await memory.saveContext({ input: userMessage }, { output: responseText });

    const response = {
      reply: responseText,
      sources: sources.map((s) => s.content),
      isCrisis,
      resources: isCrisis ? getCrisisResources() : [],
      emotion,
      agent: agentMetadata,
    };
    
    if (talkMode && audioData) {
      response.audioData = audioData;
    }

    res.json(response);
  } catch (err) {
    console.error("Error in /chat:", err.message);

    const isCrisis = containsCrisisLanguage(req.body.message || "");

    if (err.code === "content_filter" || err.status === 400) {
      const crisisResponse = isCrisis
        ? "**[Auto-Generated Safety Response]**\n\nI can hear that you're going through a really difficult time right now. Due to content safety filters, I'm currently unable to respond directly to your message, but your safety is what matters most.\n\n**Please reach out to a crisis counselor immediately:**\n• Call or text **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n• Call **911** if you're in immediate danger\n\nThese services have trained professionals available 24/7 who can provide the immediate support you need. You don't have to face this alone."
        : "**[Auto-Generated Response]**\n\nI apologize, but I'm unable to respond to your message directly due to content safety filters.\n\nIf you're experiencing a mental health crisis or having thoughts of self-harm, please contact:\n• **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n\nFor general support, you might try rephrasing your message, or reach out to a mental health professional.";

      return res.json({
        reply: crisisResponse,
        sources: [],
        isCrisis,
        resources: isCrisis ? getCrisisResources() : [],
        emotion: "concern",
        agent: { agentName: "Crisis Counselor", agentRole: "crisis-counselor" },
      });
    }

    res.status(500).json({
      error: "Model call failed",
      message: err.message,
      reply: "**[System Error]**\n\nI'm sorry, I encountered a technical problem and cannot respond right now.\n\nIf you're in crisis, please call **988** (US) or your local emergency number immediately for professional help.",
    });
  }
});

app.post("/upload-document", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileId = req.file.filename.split("-").slice(0, 2).join("-");
    res.json({
      success: true,
      id: fileId,
      name: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

app.delete("/delete-document/:id", async (req, res) => {
  try {
    const files = fs.readdirSync(userDocsPath);
    const fileToDelete = files.find((file) => file.startsWith(req.params.id));
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

app.post("/clear-memory", (req, res) => {
  const sessionId = req.body.sessionId || "default";
  delete sessionMemories[sessionId];
  res.json({ success: true, message: "Memory cleared successfully" });
});

app.post("/chat-audio", async (req, res) => {
  try {
    const {
      message: userMessage,
      useRAG = true,
      sessionId = "default",
      userInfo = null,
    } = req.body;

    const memory = getSessionMemory(sessionId);
    const orchestrator = getSessionOrchestrator(sessionId);
    const memoryVars = await memory.loadMemoryVariables({});

    const selectedAgent = await orchestrator.selectAgent(userMessage, sessionId);
    console.log(`Audio - Selected Agent: ${selectedAgent.name} (${selectedAgent.role})`);

    let systemContent = await orchestrator.getAgentSystemPrompt(selectedAgent, userInfo);

    if (mcpConnected) {
      systemContent += await orchestrator.getMCPContext(selectedAgent, userMessage);
    }

    const isCrisis = containsCrisisLanguage(userMessage);
    const sources = useRAG ? await retrieveRelevantContent(userMessage) : [];
    if (useRAG && sources.length > 0) {
      const sourcesText = sources.map((s) => s.content).join("\n\n");
      systemContent += `\n\n=== UPLOADED DOCUMENTS & MENTAL HEALTH RESOURCES ===\n${sourcesText}\n`;
    }

    systemContent += `\n\n=== VOICE MODE ===\nYou are speaking aloud in a warm, empathetic, and conversational tone. Keep responses natural and emotionally supportive, as if you're a caring friend having a voice conversation. Responses should be concise (2-4 short sentences) and conversational.`;

    const messages = buildMessages(systemContent, memoryVars, userMessage);

    const audioCompletion = await audioClient.chat.completions.create({
      model: process.env.AUDIO_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
      modalities: ["text", "audio"],
      audio: { voice: "marin", format: "mp3" },
    });

    const message = audioCompletion.choices[0]?.message;
    let responseText = "";
    
    if (message?.content) {
      responseText = message.content;
    } else if (message?.audio?.transcript) {
      responseText = message.audio.transcript;
    }
    
    const audioData = message?.audio?.data;
    const emotion = orchestrator.getAgentEmotion();
    const agentMetadata = orchestrator.getAgentMetadata();

    await memory.saveContext({ input: userMessage }, { output: responseText });

    res.json({
      reply: responseText,
      audioData,
      sources: sources.map((s) => s.content),
      isCrisis,
      resources: isCrisis ? getCrisisResources() : [],
      emotion,
      agent: agentMetadata,
    });
  } catch (err) {
    console.error("Error in /chat-audio:", err.message);

    const isCrisis = containsCrisisLanguage(req.body.message || "");

    if (err.code === "content_filter" || err.status === 400) {
      const crisisResponse = isCrisis
        ? "**[Auto-Generated Safety Response]**\n\nI can hear that you're going through a really difficult time right now. Due to content safety filters, I'm currently unable to respond directly to your message, but your safety is what matters most.\n\n**Please reach out to a crisis counselor immediately:**\n• Call or text **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n• Call **911** if you're in immediate danger\n\nThese services have trained professionals available 24/7 who can provide the immediate support you need. You don't have to face this alone."
        : "**[Auto-Generated Response]**\n\nI apologize, but I'm unable to respond to your message directly due to content safety filters.\n\nIf you're experiencing a mental health crisis or having thoughts of self-harm, please contact:\n• **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n\nFor general support, you might try rephrasing your message, or reach out to a mental health professional.";

      return res.json({
        reply: crisisResponse,
        audioData: null,
        sources: [],
        isCrisis,
        resources: isCrisis ? getCrisisResources() : [],
        emotion: "concern",
        agent: { agentName: "Crisis Counselor", agentRole: "crisis-counselor" },
      });
    }

    res.status(500).json({
      error: "Audio model call failed",
      message: err.message,
      reply: "**[System Error]**\n\nI'm sorry, I encountered a technical problem and cannot respond right now.\n\nIf you're in crisis, please call **988** (US) or your local emergency number immediately for professional help.",
      audioData: null,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Vish AI API running on port ${PORT}`);
  mcpConnected = await mcpClient.connect();
  if (mcpConnected) {
    console.log("Multi-Agent System ENABLED with MCP integration");
  } else {
    console.log("Multi-Agent System running without MCP integration");
  }
});
