import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AzureChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

const sessionMemories = {};

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const mentalHealthDocsPath = path.join(projectRoot, 'data/mental_health_resources'); // Directory for mental health PDFs

// Crisis keywords to detect emergency situations
const crisisKeywords = [
    'suicide', 'kill myself', 'end my life', 'don\'t want to live',
    'self-harm', 'hurt myself', 'harming myself', 'want to die',
    'better off dead', 'no reason to live', 'dying', 'take my own life'
];

const chatModel = new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_INFERENCE_SDK_KEY,
    azureOpenAIApiInstanceName: process.env.INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.DEPLOYMENT_NAME,
    azureOpenAIApiVersion: "2024-08-01-preview",
    temperature: 0.7,
    maxTokens: 4096,
});

let mentalHealthTexts = {};
let mentalHealthChunks = {};
const CHUNK_SIZE = 800;

// Function to check if text contains crisis indicators
function containsCrisisLanguage(text) {
    const textLower = text.toLowerCase();
    return crisisKeywords.some(keyword => textLower.includes(keyword));
}

async function loadMentalHealthPDFs() {
    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(mentalHealthDocsPath)) {
            fs.mkdirSync(mentalHealthDocsPath, { recursive: true });
            console.log(`Created directory: ${mentalHealthDocsPath}`);
            return {};
        }

        const files = fs.readdirSync(mentalHealthDocsPath).filter(file => file.endsWith('.pdf'));
        console.log(`Found ${files.length} PDF files in mental health resources directory`);

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
        console.error('Error loading mental health PDFs:', error);
        return {};
    }
}

// Initialize by loading PDFs
loadMentalHealthPDFs().then(() => {
    console.log('Mental health resources loaded successfully');
}).catch(err => {
    console.error('Failed to load mental health resources:', err);
});

function retrieveRelevantContent(query) {
    const queryTerms = query.toLowerCase().split(/\s+/)
        .filter(term => term.length > 3)
        .map(term => term.replace(/[.,?!;:()"']/g, ""));

    if (queryTerms.length === 0) return [];

    // Flatten all chunks from all documents with their source
    const allChunksWithSources = [];
    Object.keys(mentalHealthChunks).forEach(fileName => {
        mentalHealthChunks[fileName].forEach(chunk => {
            allChunksWithSources.push({ chunk, source: fileName });
        });
    });

    const scoredChunks = allChunksWithSources.map(item => {
        const chunkLower = item.chunk.toLowerCase();
        let score = 0;
        for (const term of queryTerms) {
            const regex = new RegExp(term, 'gi');
            const matches = chunkLower.match(regex);
            if (matches) score += matches.length;
        }
        return { ...item, score };
    });

    return scoredChunks
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => ({
            content: item.chunk,
            source: item.source
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

    let sources = [];
    let isCrisis = containsCrisisLanguage(userMessage);

    const memory = getSessionMemory(sessionId);
    const memoryVars = await memory.loadMemoryVariables({});

    if (useRAG) {
        sources = retrieveRelevantContent(userMessage);
    }

    // Prepare system prompt with special handling for crisis situations
    let systemContent;

    if (isCrisis) {
        systemContent = `You are a compassionate mental health support assistant speaking to someone in crisis. 
This person may be having thoughts of suicide or self-harm based on their message. 
Your priority is their safety. Respond with empathy and care. 
Remind them that help is available and they're not alone.
Suggest contacting a crisis hotline (988 in the US) or emergency services if they are in immediate danger.
DO NOT downplay their feelings or use clichés like "it gets better" or "just think positive."
Acknowledge their pain while gently encouraging them to seek professional help.`;
    }
    else if (useRAG && sources.length > 0) {
        const sourcesText = sources.map(s => s.content).join('\n\n');
        systemContent = `You are a supportive and compassionate mental health assistant.
Use the information provided below to help answer the user's question with empathy and care.
Remember to always prioritize the person's wellbeing and never give harmful advice.

--- MENTAL HEALTH RESOURCES ---
${sourcesText}
--- END OF RESOURCES ---`;
    }
    else {
        systemContent = `You are a supportive and compassionate mental health assistant. 
Your goal is to provide a safe space for people to discuss their mental health concerns.
Respond with empathy, validation, and understanding.
Never give medical advice; instead, encourage seeking professional help when appropriate.
If you don't know something, it's better to acknowledge that than to provide potentially harmful information.
Always prioritize the person's wellbeing in your responses.`;
    }

    const systemMessage = {
        role: "system",
        content: systemContent
    };

    try {
        // Build final messages array
        const messages = [
            systemMessage,
            ...(memoryVars.chat_history || []),
            { role: "user", content: userMessage },
        ];

        const response = await chatModel.invoke(messages);

        await memory.saveContext({ input: userMessage }, { output: response.content });

        res.json({
            reply: response.content,
            sources: sources.map(s => s.content),
            isCrisis: isCrisis,
            resources: isCrisis ? [
                { name: "National Suicide Prevention Lifeline", contact: "988" },
                { name: "Crisis Text Line", contact: "Text HOME to 741741" },
                { name: "International Association for Suicide Prevention", url: "https://www.iasp.info/resources/Crisis_Centres/" }
            ] : []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "Model call failed",
            message: err.message,
            reply: "I'm sorry, I encountered a problem. If you're in crisis, please call 988 (US) or your local emergency number immediately."
        });
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

// Update the console log message
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Vish AI Friend Support Chatbot API running on port ${PORT}`);
});