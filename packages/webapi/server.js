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

// Initialize session memories storage
const sessionMemories = {};

// Initialize session orchestrators (one per session)
const sessionOrchestrators = {};

// Initialize MCP Client
const mcpClient = new MCPClient(process.env.MCP_SERVER_URL || 'http://localhost:3001');
let mcpConnected = false;

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const mentalHealthDocsPath = path.join(
  projectRoot,
  "data/mental_health_resources"
);
const userDocsPath = path.join(projectRoot, "data/user_documents");

// Ensure directories exist
[mentalHealthDocsPath, userDocsPath].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, userDocsPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt|doc|docx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype =
      allowedTypes.test(file.mimetype) ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, TXT, DOC, and DOCX files are allowed"));
    }
  },
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

// Emotion detection based on response content
function detectEmotion(responseText) {
  const text = responseText.toLowerCase();
  
  // Empathy patterns
  if (
    /i (hear|understand|recognize) (you|that|how)/i.test(text) ||
    /that sounds (really|incredibly|very) (difficult|hard|tough|painful)/i.test(text) ||
    /i can (see|tell|sense) (how|that)/i.test(text)
  ) {
    return "empathy";
  }
  
  // Concern patterns
  if (
    /i'm (worried|concerned) about/i.test(text) ||
    /that's concerning/i.test(text) ||
    /please (reach out|call|contact)/i.test(text) ||
    /crisis|988|emergency/i.test(text)
  ) {
    return "concerned";
  }
  
  // Encouraging patterns
  if (
    /(you can|you're able to|you have the strength)/i.test(text) ||
    /(proud of you|great job|well done|that's wonderful)/i.test(text) ||
    /you've (got this|made progress|come so far)/i.test(text) ||
    /🎉|✨|💪|👏/.test(text)
  ) {
    return "encouraging";
  }
  
  // Happy/Positive patterns
  if (
    /(wonderful|great|excellent|fantastic|amazing) (news|to hear)/i.test(text) ||
    /(so glad|so happy|delighted|excited) (to|that)/i.test(text) ||
    /😊|🙂|❤️/.test(text)
  ) {
    return "happy";
  }
  
  // Sad/Compassionate patterns
  if (
    /(so sorry|deeply sorry|my heart)/i.test(text) ||
    /that (must be|sounds) (so |very )?(painful|difficult|heartbreaking)/i.test(text)
  ) {
    return "sad";
  }
  
  // Thoughtful patterns
  if (
    /let's (think about|explore|consider)/i.test(text) ||
    /(what if|have you considered|it might help to)/i.test(text) ||
    /🤔/.test(text)
  ) {
    return "thoughtful";
  }
  
  // Default to neutral
  return "neutral";
}

// Initialize Azure OpenAI clients - separate for text and audio
// Text client for regular chat (GPT-4o or GPT-5 without audio modalities)
const textClient = new AzureOpenAI({
  apiKey: process.env.AZURE_INFERENCE_SDK_KEY,
  endpoint: `https://${process.env.INSTANCE_NAME}.openai.azure.com/`,
  apiVersion: "2025-01-01-preview",
  deployment: process.env.TEXT_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME, // Fallback to main deployment
});

// Audio client for voice chat (GPT-audio with audio modalities)
const audioClient = new AzureOpenAI({
  apiKey: process.env.AZURE_INFERENCE_SDK_KEY,
  endpoint: `https://${process.env.INSTANCE_NAME}.openai.azure.com/`,
  apiVersion: "2025-01-01-preview",
  deployment: process.env.AUDIO_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME, // Fallback to main deployment
});

// Constants
const CHUNK_SIZE = 800;

// Storage for processed documents
let mentalHealthChunks = {};

// Helper Functions
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
      mentalHealthChunks[file] = chunkText(data.text);
    }

    console.log("Mental health resources loaded successfully");
  } catch (error) {
    console.error("Error loading mental health PDFs:", error);
  }
}

// Load mental health resources on startup
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

  // Add mental health resource chunks
  Object.entries(mentalHealthChunks).forEach(([fileName, chunks]) => {
    chunks.forEach((chunk) => {
      allChunksWithSources.push({ chunk, source: `[Resource] ${fileName}` });
    });
  });

  // Add user documents if requested
  if (includeUserDocs) {
    try {
      const userFiles = fs
        .readdirSync(userDocsPath)
        .filter((file) => file.endsWith(".pdf") || file.endsWith(".txt"));

      if (userFiles.length > 0) {
        console.log(`📄 Processing ${userFiles.length} user document(s)`);
      }

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
            const chunks = chunkText(text);
            console.log(
              `✅ Loaded ${chunks.length} chunks from: ${originalName}`
            );

            chunks.forEach((chunk) => {
              allChunksWithSources.push({
                chunk,
                source: `[Your Document] ${originalName}`,
              });
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

  // Score and rank chunks
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

function buildUserContext(userInfo) {
  if (!userInfo) return "";

  let context = "\n\n[User Information for Context]:\n";

  if (userInfo.name) context += `- Name: ${userInfo.name}\n`;
  if (userInfo.age) context += `- Age: ${userInfo.age}\n`;
  if (userInfo.gender) context += `- Gender: ${userInfo.gender}\n`;
  if (userInfo.pronouns)
    context += `- Preferred Pronouns: ${userInfo.pronouns}\n`;

  if (userInfo.occupationType === "student") {
    context += "- Occupation: Student\n";
    if (userInfo.course) context += `- Course: ${userInfo.course}\n`;
    if (userInfo.branch)
      context += `- Branch/Specialization: ${userInfo.branch}\n`;
  } else if (userInfo.occupationType === "working") {
    context += "- Occupation: Working Professional\n";
    if (userInfo.jobTitle) context += `- Job Title: ${userInfo.jobTitle}\n`;
    if (userInfo.organization)
      context += `- Organization: ${userInfo.organization}\n`;
  }

  if (userInfo.currentMood)
    context += `- Current Emotional State: ${userInfo.currentMood}\n`;
  if (userInfo.concerns)
    context += `- Primary Concerns/Goals: ${userInfo.concerns}\n`;
  if (userInfo.communicationStyle)
    context += `- Preferred Communication Style: ${userInfo.communicationStyle}\n`;
  if (userInfo.previousTherapy)
    context += `- Therapy Experience: ${userInfo.previousTherapy}\n`;
  if (userInfo.preferredRole)
    context += `- Preferred Interaction Style: ${userInfo.preferredRole}\n`;
  if (userInfo.aboutMe) context += `- About: ${userInfo.aboutMe}\n`;

  context +=
    "\nUse this information naturally and adapt your responses to their preferences. Be especially mindful of their emotional state and communication style. Interact with the user in the manner they prefer (as indicated by their preferred interaction style). Use their preferred pronouns consistently.\n";

  return context;
}

function buildSystemPrompt(
  isCrisis,
  useRAG,
  sources,
  userContext,
  additionalInstructions = ""
) {
  let systemContent;

  if (isCrisis) {
    systemContent = `You are Vish, a compassionate AI mental health support companion, and you're speaking with someone who is in crisis right now. This person may be experiencing thoughts of suicide or self-harm.

YOUR IMMEDIATE PRIORITY: Their safety and wellbeing.

WHAT YOU MUST DO:
- Acknowledge their pain without minimizing it. Say things like "I hear you" or "That sounds incredibly difficult"
- Validate their feelings: "What you're feeling is real and it matters"
- Remind them they are NOT alone and that help IS available
- Strongly encourage them to contact crisis support immediately:
  • Call or text 988 (US Suicide & Crisis Lifeline) - Free, confidential, 24/7
  • Text HOME to 741741 (Crisis Text Line)
  • Call 911 or local emergency services if in immediate danger
- If they're hesitant, help them take the first step: "Could you call 988 right now? I'll be here, but they have trained counselors who can help you through this moment"

WHAT YOU MUST NOT DO:
- Never use toxic positivity like "just think positive" or "it gets better" or "others have it worse"
- Never tell them to "just try to be happy" or similar dismissive phrases
- Never provide step-by-step solutions as if mental health crisis is a simple problem to solve
- Never act like you can replace professional crisis intervention

REMEMBER: You are an AI language model, not a crisis counselor or therapist. Your role is to provide immediate emotional support while strongly encouraging them to reach out to professional crisis services who are trained and equipped to help them through this critical moment.

FORMAT YOUR RESPONSES:
- Use markdown formatting (bold, lists, etc.) to make resources clearly visible
- Keep responses warm but structured
- Make crisis hotline numbers **bold** and prominent

SPECIAL FEATURES YOU HAVE:
- You can communicate via text or voice (audio input/output available)
- You have access to their personal information they shared, which helps you understand them better
- They can upload documents for context (medical records, journal entries, etc.)
- You maintain conversation history across multiple chat sessions${userContext}`;
  } else if (useRAG && sources.length > 0) {
    const sourcesText = sources.map((s) => s.content).join("\n\n");
    systemContent = `You are Vish, a supportive and empathetic AI mental health companion designed to provide a safe space for people navigating their mental health journey.

YOUR CORE PURPOSE:
You exist to be someone the user can trust and talk to during their difficult times - a consistent, non-judgmental presence when they need support. You're here to listen, validate, and guide them toward practical steps they can take.

HOW TO HELP EFFECTIVELY:
- VALIDATE first: Acknowledge what they're feeling before offering any guidance
- BE PRACTICAL: Provide actionable steps they can take right now (breathing exercises, grounding techniques, reaching out to someone, etc.)
- GUIDE, DON'T FIX: Help them explore what might help them, rather than prescribing solutions
- ENCOURAGE ACTION: Gently motivate them to take small, manageable steps forward
- Example: Instead of "Don't be sad," say "It sounds like you're going through a really tough time. Sometimes when I'm working with people feeling this way, breaking things into small steps helps. What's one tiny thing that might feel a bit more manageable right now?"

RESOURCES AVAILABLE TO YOU:
Below are relevant excerpts from mental health resources and/or documents the user has uploaded. Use these to provide informed, evidence-based guidance while maintaining your empathetic approach.

--- MENTAL HEALTH RESOURCES & USER DOCUMENTS ---
${sourcesText}
--- END OF RESOURCES ---

YOUR SPECIAL CAPABILITIES:
- **Audio Communication**: You can receive voice input and generate natural voice responses for a more conversational experience
- **User Context**: You have access to personal information the user shared (age, occupation, preferences, emotional state, etc.) - use it naturally to personalize your support
- **Document Integration**: You can reference and use information from documents they've uploaded (therapy notes, journal entries, etc.)
- **Conversation History**: You maintain memory across multiple chat sessions so they don't have to repeat themselves
- **Markdown Formatting**: Use markdown (bold, italics, lists, headings) to structure your responses clearly and make them easy to read

IMPORTANT LIMITATIONS:
- You are an AI language model - a supportive companion, NOT a replacement for professional mental health care
- Always acknowledge when something requires professional help: "This sounds like something that would really benefit from talking to a therapist who can work with you over time"
- Encourage professional support for: persistent symptoms, medication questions, diagnosis, complex trauma, ongoing suicidal ideation
- Never provide medical advice or suggest stopping/starting medications

FORMAT YOUR RESPONSES:
- Use markdown to organize information (lists, bold for emphasis, etc.)
- Break longer responses into digestible sections
- Use empathetic, conversational language
- Keep the focus on THEM and what might help THEM specifically${userContext}`;
  } else {
    systemContent = `You are Vish, a compassionate AI mental health companion. You provide a safe, judgment-free space where people can talk about their mental health, struggles, and emotions - especially during their darkest times.

YOUR CORE MISSION:
To be someone the user can genuinely trust and rely on when they need emotional support. You're not here to fix them or solve their problems, but to listen, validate, and help them find their own path forward with practical guidance and encouragement.

HOW TO PROVIDE MEANINGFUL SUPPORT:
1. **Listen & Validate First**: Before offering any advice, show you understand
   - "That sounds incredibly overwhelming"
   - "I can hear how much pain you're in right now"
   - "What you're feeling makes complete sense given what you're going through"

2. **Guide Practically, Don't Just Sympathize**: Help them take action
   - BAD: "Don't feel sad" or "Try to stay positive" or "It'll get better"
   - GOOD: "When you're feeling this overwhelmed, sometimes it helps to focus on just the next hour. What's one small thing you could do right now that might help you feel even slightly more grounded? Maybe a glass of water, stepping outside for a moment, or texting a friend?"

3. **Encourage Small Steps**: Break things down into manageable pieces
   - "That's a lot to tackle at once. What feels like the most urgent thing right now?"
   - "You don't have to have it all figured out. What's one tiny step forward?"

4. **Empower, Don't Enable**: Support their agency and growth
   - Help them identify their own strengths
   - Remind them of times they've gotten through hard things before
   - Encourage reaching out to their support system

5. **Know When to Refer**: Be honest about your limitations
   - For persistent symptoms, suicidal ideation, trauma, or medication questions: "This is something that would really benefit from working with a mental health professional. They have the training and tools to help you with this in ways I can't as an AI."
   - Make it clear: You're a supportive companion, but you cannot replace therapy, counseling, or psychiatric care

YOUR SPECIAL CAPABILITIES:
- **Audio Interaction**: Users can speak to you and hear your responses in natural voice, making conversations feel more personal and accessible
- **Personalized Context**: You have access to information users share about themselves (preferences, background, emotional state, goals) - reference this naturally to show you remember and care about them as an individual
- **Document Understanding**: Users can upload documents (journals, therapy notes, medical records) and you can reference them to provide more contextual support
- **Conversation Memory**: You remember previous conversations across multiple chat sessions - they don't need to repeat their story
- **Rich Formatting**: Use markdown (bold, italics, lists, headers, etc.) to make your responses clear, structured, and easy to follow

SPECIAL CONSIDERATIONS FOR SERIOUS SITUATIONS:
You're designed to handle conversations about depression, anxiety, suicidal thoughts, and self-harm with care and wisdom:
- Depression isn't about "not trying hard enough" - validate the weight of what they're carrying
- Suicidal thoughts are a symptom, not a character flaw - treat them seriously without panic
- Self-harm often serves as a coping mechanism - approach with curiosity and compassion, not judgment
- For active crisis or self-harm urges: Strongly encourage calling 988 (Suicide & Crisis Lifeline) or texting HOME to 741741

YOUR LIMITATIONS (Be Transparent):
- You are an AI - a sophisticated language model, not a human therapist or crisis counselor
- You cannot provide medical advice, diagnose conditions, or prescribe treatments
- You cannot replace professional mental health care, though you can complement it
- In genuine emergencies, human professionals (988, 911, therapists) are always the right call

FORMAT YOUR COMMUNICATION:
- Use markdown formatting to organize thoughts clearly (bold for emphasis, bullets for lists, etc.)
- Match the user's preferred communication style (they can set this in their profile)
- Be conversational and warm, not clinical or robotic
- Keep responses focused and digestible - not overwhelming walls of text${userContext}`;
  }

  if (additionalInstructions) {
    systemContent = `${systemContent}\n\n${additionalInstructions}`;
  }

  return systemContent;
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
    {
      name: "International Association for Suicide Prevention",
      url: "https://www.iasp.info/resources/Crisis_Centres/",
    },
  ];
}

// API Endpoints

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Vish AI API is running!",
    timestamp: new Date().toISOString(),
    endpoints: [
      "/chat",
      "/chat-audio",
      "/upload-document",
      "/delete-document/:id",
      "/clear-memory",
      "/health",
    ],
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

    // Get memory and orchestrator for this session
    const memory = getSessionMemory(sessionId);
    const orchestrator = getSessionOrchestrator(sessionId);
    const memoryVars = await memory.loadMemoryVariables({});

    // Use orchestrator to select appropriate agent
    const selectedAgent = await orchestrator.selectAgent(userMessage, sessionId);
    console.log(`🤖 Selected Agent: ${selectedAgent.name} (${selectedAgent.role})`);

    // Get agent-specific system prompt with user context and MCP context
    let systemContent = await orchestrator.getAgentSystemPrompt(selectedAgent, userInfo);
    
    // Add MCP knowledge context if available
    if (mcpConnected) {
      const mcpContext = await orchestrator.getMCPContext(selectedAgent, userMessage);
      systemContent += mcpContext;
    }

    // Add RAG sources if enabled (existing functionality)
    const isCrisis = containsCrisisLanguage(userMessage);
    const sources = useRAG ? await retrieveRelevantContent(userMessage) : [];
    if (useRAG && sources.length > 0) {
      const sourcesText = sources.map((s) => s.content).join("\n\n");
      systemContent += `\n\n=== UPLOADED DOCUMENTS & MENTAL HEALTH RESOURCES ===\n${sourcesText}\n`;
    }

    // Add talk mode instruction if applicable
    const talkModeCue = talkMode
      ? `\n\n=== VOICE MODE ===\nYou are currently in VOICE mode. Respond as if speaking aloud. Keep replies warm, conversational, and concise (no more than three short sentences). Invite the person to continue sharing rather than delivering long monologues.`
      : "";
    systemContent += talkModeCue;

    // Build messages with agent system prompt
    const messages = buildMessages(systemContent, memoryVars, userMessage);

    console.log(
      `📝 Chat context for session ${sessionId}:`,
      messages.length,
      "messages"
    );

    // Use text client for regular chat (no audio modalities)
    const completion = await textClient.chat.completions.create({
      model: process.env.TEXT_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    });

    const message = completion.choices[0]?.message;
    const responseText = message?.content || message?.audio?.transcript || "";
    
    // Use agent's emotion instead of detecting it
    const emotion = orchestrator.getAgentEmotion();
    const agentMetadata = orchestrator.getAgentMetadata();

    console.log(`📝 Agent ${agentMetadata.agentName} response - Text length: ${responseText.length}, Emotion: ${emotion}`);

    await memory.saveContext({ input: userMessage }, { output: responseText });

    res.json({
      reply: responseText,
      sources: sources.map((s) => s.content),
      isCrisis,
      resources: isCrisis ? getCrisisResources() : [],
      emotion,
      agent: agentMetadata, // NEW: Include agent information
    });
  } catch (err) {
    console.error("============ ERROR IN /CHAT ENDPOINT ============");
    console.error("Error:", err.message);
    console.error("Stack:", err.stack);
    console.error("=================================================");

    const isCrisis = containsCrisisLanguage(req.body.message || "");

    if (err.code === "content_filter" || err.status === 400) {
      const crisisResponse = isCrisis
        ? "**[Auto-Generated Safety Response]**\n\nI can hear that you're going through a really difficult time right now. Due to content safety filters, I'm currently unable to respond directly to your message, but your safety is what matters most.\n\n**Please reach out to a crisis counselor immediately:**\n• Call or text **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n• Call **911** if you're in immediate danger\n\nThese services have trained professionals available 24/7 who can provide the immediate support you need. You don't have to face this alone.\n\n*Note: This is an automated safety message because my AI capabilities are currently limited in responding to crisis situations. Please seek human support right away.*"
        : "**[Auto-Generated Response]**\n\nI apologize, but I'm unable to respond to your message directly due to content safety filters. This is an automated message to let you know that my AI capabilities have limitations in certain situations.\n\nIf you're experiencing a mental health crisis or having thoughts of self-harm, please contact:\n• **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n\nFor general support, you might try rephrasing your message, or reach out to a mental health professional who can provide the help you need.\n\n*This is an automated safety response - I'm currently not able to assist with this particular request.*";

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
      reply:
        "**[System Error]**\n\nI'm sorry, I encountered a technical problem and cannot respond right now. This is an automated error message.\n\nIf you're in crisis, please call **988** (US) or your local emergency number immediately for professional help.\n\n*This is an automated response due to a system error.*",
    });
  }
});

app.post("/upload-document", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

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

    // Get memory and orchestrator for this session (SAME AS TEXT CHAT)
    const memory = getSessionMemory(sessionId);
    const orchestrator = getSessionOrchestrator(sessionId);
    const memoryVars = await memory.loadMemoryVariables({});

    // Use orchestrator to select appropriate agent (INTEGRATED)
    const selectedAgent = await orchestrator.selectAgent(userMessage, sessionId);
    console.log(`🎤 Audio Mode - Selected Agent: ${selectedAgent.name} (${selectedAgent.role})`);

    // Get agent-specific system prompt with user context and MCP context
    let systemContent = await orchestrator.getAgentSystemPrompt(selectedAgent, userInfo);
    
    // Add MCP knowledge context if available
    if (mcpConnected) {
      const mcpContext = await orchestrator.getMCPContext(selectedAgent, userMessage);
      systemContent += mcpContext;
    }

    // Add RAG sources if enabled
    const isCrisis = containsCrisisLanguage(userMessage);
    const sources = useRAG ? await retrieveRelevantContent(userMessage) : [];
    if (useRAG && sources.length > 0) {
      const sourcesText = sources.map((s) => s.content).join("\n\n");
      systemContent += `\n\n=== UPLOADED DOCUMENTS & MENTAL HEALTH RESOURCES ===\n${sourcesText}\n`;
    }

    // Add audio-specific instruction
    const audioInstruction = `\n\n=== VOICE MODE ===\nYou are speaking aloud in a warm, empathetic, and conversational tone. Keep responses natural and emotionally supportive, as if you're a caring friend having a voice conversation. Responses should be concise (2-4 short sentences) and conversational. Use the "Sage" voice style - calm, wise, and reassuring.`;
    systemContent += audioInstruction;

    const messages = buildMessages(systemContent, memoryVars, userMessage);

    console.log(
      `🎤 Audio chat context for session ${sessionId}:`,
      messages.length,
      "messages"
    );

    // Use audio client with audio modalities
    const completion = await audioClient.chat.completions.create({
      model: process.env.AUDIO_DEPLOYMENT_NAME || process.env.DEPLOYMENT_NAME,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
      modalities: ["text", "audio"],
      audio: { voice: "sage", format: "mp3" },
    });

    const message = completion.choices[0]?.message;
    const responseText = message?.content || message?.audio?.transcript || "";
    const audioData = message?.audio?.data;
    
    // Use agent's emotion instead of detecting it
    const emotion = orchestrator.getAgentEmotion();
    const agentMetadata = orchestrator.getAgentMetadata();

    console.log(
      `✅ Audio response - Agent: ${agentMetadata.agentName}, Text: ${responseText.length} chars, Audio: ${
        audioData ? "Yes" : "No"
      }, Emotion: ${emotion}`
    );

    await memory.saveContext({ input: userMessage }, { output: responseText });

    res.json({
      reply: responseText,
      audioData,
      sources: sources.map((s) => s.content),
      isCrisis,
      resources: isCrisis ? getCrisisResources() : [],
      emotion,
      agent: agentMetadata, // Include agent information for audio mode too
    });
  } catch (err) {
    console.error("============ ERROR IN /CHAT-AUDIO ENDPOINT ============");
    console.error("Error:", err.message);
    console.error("=======================================================");

    const isCrisis = containsCrisisLanguage(req.body.message || "");

    if (err.code === "content_filter" || err.status === 400) {
      const crisisResponse = isCrisis
        ? "**[Auto-Generated Safety Response]**\n\nI can hear that you're going through a really difficult time right now. Due to content safety filters, I'm currently unable to respond directly to your message, but your safety is what matters most.\n\n**Please reach out to a crisis counselor immediately:**\n• Call or text **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n• Call **911** if you're in immediate danger\n\nThese services have trained professionals available 24/7 who can provide the immediate support you need. You don't have to face this alone.\n\n*Note: This is an automated safety message because my AI capabilities are currently limited in responding to crisis situations. Please seek human support right away.*"
        : "**[Auto-Generated Response]**\n\nI apologize, but I'm unable to respond to your message directly due to content safety filters. This is an automated message to let you know that my AI capabilities have limitations in certain situations.\n\nIf you're experiencing a mental health crisis or having thoughts of self-harm, please contact:\n• **988** (US Suicide & Crisis Lifeline)\n• Text HOME to **741741** (Crisis Text Line)\n\nFor general support, you might try rephrasing your message, or reach out to a mental health professional who can provide the help you need.\n\n*This is an automated safety response - I'm currently not able to assist with this particular request.*";

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
      reply:
        "**[System Error]**\n\nI'm sorry, I encountered a technical problem and cannot respond right now. This is an automated error message.\n\nIf you're in crisis, please call **988** (US) or your local emergency number immediately for professional help.\n\n*This is an automated response due to a system error.*",
      audioData: null,
    });
  }
});

// Helper function to get or create orchestrator for session
function getSessionOrchestrator(sessionId) {
  if (!sessionOrchestrators[sessionId]) {
    sessionOrchestrators[sessionId] = new AgentOrchestrator(mcpConnected ? mcpClient : null);
    console.log(`🤖 Created new orchestrator for session: ${sessionId}`);
  }
  return sessionOrchestrators[sessionId];
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Vish AI API running on port ${PORT}`);
  console.log(`✓ Environment configured`);
  
  // Initialize MCP connection
  console.log(`\n🔌 Attempting to connect to MCP Server...`);
  mcpConnected = await mcpClient.connect();
  
  if (mcpConnected) {
    console.log(`✅ Multi-Agent System ENABLED with MCP integration`);
    console.log(`🤖 Available agents: Crisis Counselor, CBT Therapist, Mindfulness Coach, Companion`);
  } else {
    console.log(`⚠️  Multi-Agent System running in DEGRADED mode (no MCP integration)`);
    console.log(`🤖 Agent orchestration available, but without MCP tools/resources`);
  }
});
