# VishAI - AI Dev Days Hackathon Submission

## **Multi-Agent Mental Health Support System with Azure MCP Integration**

---

## 🏆 Hackathon Categories

**Primary Target:** Grand Prize - Build AI Applications & Agents using Microsoft AI Platform

**Secondary Targets:**
- Best Multi-Agent System
- Best Azure Integration
- Best Enterprise Solution

---

## 🎯 Project Overview

**VishAI** is an advanced multi-agent mental health support application leveraging **Microsoft's AI platform** to provide compassionate, intelligent, and personalized mental health support through specialized AI agents coordinated via **Azure MCP** (Model Context Protocol).

### The Problem We're Solving

- **40% of adults** report anxiety or depression symptoms
- Mental health services are **inaccessible** for many (cost, stigma, availability)
- Crisis situations require **immediate, informed responses**
- One-size-fits-all chatbots lack **specialized expertise**

### Our Solution

A **multi-agent AI system** where specialized agents (Crisis Counselor, CBT Therapist, Mindfulness Coach, Companion) collaborate through Azure MCP to provide expert, context-aware mental health support 24/7.

---

## 🌟 HERO TECHNOLOGIES USED

###  1. **Azure MCP (Model Context Protocol)** ✨ **CRITICAL**

**Implementation:**
- **MCP Server** (`packages/mcp-server/`) exposes mental health knowledge base, crisis protocols, CBT techniques, and coping strategies as MCP resources and tools
- **MCP Client** in backend connects agents to resources via standardized protocol
- **Agent-to-Agent (A2A) Communication** through MCP for knowledge sharing

**MCP Resources Exposed:**
- `vishai://crisis-resources` - Emergency hotlines and crisis intervention protocols
- `vishai://coping-strategies` - Evidence-based coping mechanisms
- `vishai://cbt-techniques` - Cognitive Behavioral Therapy methods
- `vishai://mental-health-topics` - Mental health education content

**MCP Tools Provided:**
- `search_mental_health_topics` - Semantic search across knowledge base
- `get_crisis_resources` - Retrieve emergency resources by country/type
- `recommend_coping_strategies` - Strategy recommendations by condition/urgency
- `get_cbt_technique` - Retrieve specific CBT techniques with steps
- `assess_crisis_level` - Analyze message for crisis severity

###  2. **Microsoft Agent Framework** (Multi-Agent Orchestration)

**Implementation:**
- **Agent Orchestrator** (`packages/webapi/agents/orchestrator.js`) intelligently routes user messages to specialized agents
- **4 Specialized Agents** with distinct expertise and system prompts
- **Dynamic Agent Selection** based on message content, context, and MCP crisis assessment
- **Agent Coordination** - Agents aware of each other, can hand off seamlessly

**Specialized Agents:**

#### 🚨 **Crisis Counselor Agent**
- **Role:** Immediate crisis intervention and suicide prevention
- **Triggers:** Crisis keywords (suicide, self-harm, hopeless, want to die)
- **MCP Tools:** `assess_crisis_level`, `get_crisis_resources`
- **Priority:** User safety above all else
- **Action:** Provides emergency resources (988 Lifeline, Crisis Text Line) immediately

#### 🧠 **CBT Therapist Agent**
- **Role:** Evidence-based cognitive behavioral therapy
- **Triggers:** Keywords like "negative thoughts", "overthinking", "cognitive distortions"
- **MCP Tools:** `get_cbt_technique`, `search_mental_health_topics`
- **Techniques:** Thought challenging, behavioral activation, problem-solving, exposure therapy
- **Approach:** Socratic questioning, structured exercises, homework assignment

#### 🧘 **Mindfulness Coach Agent**
- **Role:** Mindfulness, meditation, stress reduction
- **Triggers:** Keywords like "breathing", "meditation", "panic attack", "stressed", "overwhelmed"
- **MCP Tools:** `recommend_coping_strategies`
- **Techniques:** 4-7-8 breathing, box breathing, 5-4-3-2-1 grounding, body scan
- **Approach:** Real-time guided exercises, calm and soothing tone

#### 💬 **Conversational Companion Agent**
- **Role:** General emotional support and active listening
- **Triggers:** Default agent for general conversations
- **MCP Tools:** `search_mental_health_topics`, `recommend_coping_strategies`
- **Approach:** Empathetic listening, validation, personalized support
- **Integration:** Knows when to refer to specialized agents

### 3. **Azure OpenAI Service** (GPT-4o with Audio)

**Implementation:**
- **Model:** GPT-4o with multimodal capabilities (text + audio)
- **Audio Modalities:** Text-to-Speech with "Sage" voice for natural conversations
- **Voice Interaction:** Full voice chat with lip-synced 3D avatar
- **Configuration:** Temperature 0.7, max tokens 4096, streaming support

### 4. **Azure Infrastructure & Services**

**Current Deployment:**
- **Azure App Service:** Backend API hosting (Express.js) 
- **Azure Static Web Apps:** Frontend hosting (Vite + Lit components)
- **Infrastructure as Code:** Bicep templates in `infra/` for reproducible deployment
- **Azure Developer CLI:** `azd` for streamlined deployment

**Recommended Enterprise Enhancements (for production):**
- **Azure AI Search:** Semantic search with vector embeddings
- **Azure AI Content Safety:** Content filtering and harm detection
- **Azure Cosmos DB:** Persistent conversation storage
- **Azure Blob Storage:** User document storage
- **Azure Key Vault:** Secure credential management
- **Azure Application Insights:** Performance monitoring and analytics
- **Azure Monitor:** Resource health and alerting

---

## 🏗️ ARCHITECTURE

```
┌────────────────────────────────────────────────────────────┐
│                     FRONTEND (Vue + Lit)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Chat UI     │  │  3D Avatar   │  │  Voice Interface │ │
│  │  (chat.js)   │  │  (avatar.ts) │  │  (Web Speech)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘ │
│         └───────────────────┤                               │
│                             ▼                               │
│                  Fetch API (HTTP/REST)                      │
└────────────────────────────────┬──────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────┐
│               BACKEND API (Express.js)                     │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │          Agent Orchestrator                         │ │
│  │                                                     │ │
│  │  • Analyzes user message                           │ │
│  │  • Calls MCP assess_crisis_level tool              │ │
│  │  • Routes to appropriate specialized agent         │ │
│  │  • Builds agent-specific system prompt             │ │
│  └─────────────┬───────────────────────────────────────┘ │
│                │                                           │
│    ┌───────────┴────────────┬────────────┬───────────┐   │
│    ▼                        ▼            ▼           ▼   │
│  ┌─────┐  ┌─────────────┐  ┌──────────┐  ┌──────────┐  │
│  │Crisis│  │CBT Therapist│  │Mindfulness│  │Companion│  │
│  │Agent │  │   Agent     │  │  Coach    │  │  Agent  │  │
│  └──┬──┘  └──────┬──────┘  └─────┬────┘  └────┬─────┘  │
│     └────────────┴────────────────┴────────────┘         │
│                        │                                   │
│                        ▼                                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           MCP Client (HTTP)                         │ │
│  │                                                     │ │
│  │  • Calls MCP tools                                  │ │
│  │  • Retrieves resources                              │ │
│  │  • Provides context to agents                       │ │
│  └─────────────────────┬───────────────────────────────┘ │
└────────────────────────┼─────────────────────────────────┘
                         │
                         ▼  HTTP/JSON
┌────────────────────────────────────────────────────────────┐
│              MCP SERVER (Express + MCP SDK)                │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  MCP Protocol Implementation                         │ │
│  │                                                      │ │
│  │  Endpoints:                                          │ │
│  │  • GET  /mcp/resources      - List resources        │ │
│  │  • GET  /mcp/resources/:id  - Read resource         │ │
│  │  • GET  /mcp/tools          - List tools            │ │
│  │  • POST /mcp/tools/call     - Execute tool          │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │ Knowledge   │  │   Crisis    │  │  CBT Techniques  │ │
│  │    Base     │  │  Resources  │  │ Coping Strategies│ │
│  └─────────────┘  └─────────────┘  └──────────────────┘ │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│              AZURE OPENAI SERVICE                          │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  GPT-4o (Text + Audio Modalities)                    │ │
│  │                                                      │ │
│  │  • Processes agent system prompts                    │ │
│  │  • Generates empathetic responses                    │ │
│  │  • TTS with "Sage" voice                             │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 KEY FEATURES

### **1. Intelligent Agent Orchestration**

**How It Works:**
1. User sends message
2. Orchestrator analyzes content and calls MCP `assess_crisis_level` tool
3. Selects appropriate specialized agent based on:
   - Crisis level detected
   - Keyword matching (CBT, mindfulness, crisis terms)
   - Conversation context
4. Agent receives:
   - Agent-specific system prompt
   - User profile/context
   - MCP resource context (relevant knowledge)
   - Conversation history (LangChain memory)
5. Azure OpenAI generates response with agent's expertise and emotion
6. Frontend updates avatar emotion based on agent type

**Example Flow:**

```
User: "I'm feeling hopeless and can't go on"
  ↓
MCP assess_crisis_level → SEVERE
  ↓
Crisis Counselor Agent selected
  ↓
MCP get_crisis_resources (US, suicide)
  ↓
Response: Immediate 988 hotline, validation, crisis resources
  ↓
Avatar emotion: "concern"
```

### **2. Azure MCP Integration**

**MCP Resources (4 collections):**
- Mental health conditions, symptoms, treatments
- 50+ coping strategies (immediate, short-term, long-term)
- 4 CBT techniques with step-by-step guidance
- Crisis resources for US, UK, CA, AU + protocols

**MCP Tools (5 functions):**
- Smart crisis detection and classification
- Resource retrieval by country/type
- Strategy recommendations by condition/urgency
- CBT technique retrieval
- Mental health knowledge search

**Agent-to-Agent Communication:**
- Agents call MCP tools to access shared knowledge
- Standardized protocol ensures consistency
- Graceful degradation if MCP unavailable

### **3. 3D Avatar with Emotion-Driven Expressions**

- **VRM-based 3D character** using Three.js and @pixiv/three-vrm
- **7 Emotion States:** empathy, concern, encouraging, happy, sad, thoughtful, neutral
- **Emotion Synced to Agent:** Each agent has default emotion
- **Lip Sync:** Audio-reactive mouth movements via Web Audio API
- **Idle Animations:** Breathing, blinking, head movement
- **Interactive:** Orbit controls for user engagement

### **4. Voice Interaction (Talk Mode)**

- **Speech Recognition:** Web Speech API for voice input
- **Azure TTS:** Natural voice synthesis with "Sage" voice
- **Barge-In:** Stops AI speaking when user interrupts
- **Continuous Flow:** Auto-resumes listening after response
- **Avatar Integration:** Lip sync + emotion = immersive experience

### **5. Personalized User Context**

**User Profile Stored:**
- Demographics (name, age, gender, pronouns)
- Occupation (student/working details)
- Current emotional state
- Primary concerns/goals
- Communication style preferences (direct, gentle, analytical, empathetic)
- Preferred interaction role (friend, therapist, mentor, coach)
- "About Me" section

**Context Usage:**
- Automatically included in agent system prompts
- Enables personalized responses
- Maintains consistency across sessions
- Adapts communication style

### **6. RAG with Mental Health Resources**

**Current Implementation:**
- PDF parsing from `data/mental_health_resources/`
- Chunk-based retrieval (800 chars)
- Keyword scoring for relevance
- Top 3 chunks included in context

**Recommended Enhancement:**
- Azure AI Search with vector embeddings
- Semantic similarity search
- Hybrid search (keywords + vectors)
- Re-ranking for precision

### **7. Session Management & Memory**

- **LangChain BufferMemory:** Conversation history per session
- **Multiple Sessions:** Users can start new conversations
- **In-Memory Storage:** Current (for demo), database recommended for production
- **Memory Clearing:** Users can reset conversation

---

## 📊 JUDGING CRITERIA ALIGNMENT

### **1. Technological Implementation (20%)**

✅ **Quality Software Development:**
- Clean, modular architecture
- Separation of concerns (MCP server, agents, orchestrator, API)
- Error handling and graceful degradation
- Infrastructure as Code (Bicep)

✅ **Effective Use of Hero Technologies:**
- **Azure MCP:** Full implementation with resources and tools
- **Azure OpenAI:** GPT-4o with multimodal (text + audio)
- **Multi-Agent Orchestration:** 4 specialized agents with coordination
- **Azure Infrastructure:** App Service, Static Web Apps, IaC with Bicep

✅ **Well-Structured Code:**
- Documented functions and classes
- Consistent naming conventions
- Modular file organization
- ESM modules throughout

### **2. Agentic Design & Innovation (20%)**

✅ **Creative Application of Agentic AI:**
- **Novel approach:** Mental health expertise distributed across specialized agents
- **Intelligent routing:** MCP-powered crisis assessment for agent selection
- **Context-aware:** Agents use user profiles and MCP resources
- **Collaborative:** Agents aware of each other, seamless handoffs

✅ **Sophisticated Agent Orchestration:**
- **4 specialized agents** with distinct expertise
- **MCP-based coordination** for knowledge sharing
- **Dynamic agent selection** based on content and crisis level
- **Agent metadata** returned to frontend for transparency

✅ **Multi-Agent Collaboration:**
- Agents share access to MCP knowledge base
- Crisis Counselor escalates immediately when needed
- CBT Therapist can refer to Mindfulness Coach
- Companion Agent routes to specialists

### **3. Real-World Impact & Applicability (20%)**

✅ **Significance of Problem:**
- **40% of adults** experience anxiety/depression
- Mental health care is **inaccessible** for many
- **Crisis situations** need immediate, informed responses
- **Stigma** prevents people from seeking help

✅ **Production Deployment Readiness:**
- Currently deployed on Azure (App Service + Static Web Apps)
- Infrastructure as Code (Bicep) for reproducibility
- Environment configuration via Azure Key Vault (recommended)
- Scalable architecture ready for enterprise use

✅ **Potential Impact:**
- **24/7 availability** - never closes
- **Immediate crisis intervention** - saves lives
- **Evidence-based techniques** - CBT, mindfulness, coping strategies
- **Accessible** - free, no stigma, private
- **Scalable** - can serve millions

### **4. User Experience & Presentation (20%)**

✅ **Well-Designed UX:**
- **3D avatar** creates emotional connection
- **Voice interaction** for natural conversation
- **Markdown rendering** for clear information structure
- **Session management** for conversation continuity
- **Document upload** for personalized context
- **Mobile-responsive** design

✅ **Clear Communication:**
- Agent name displayed to user (transparency)
- Source attribution for RAG responses
- Crisis resources prominently displayed when needed
- Markdown formatting for readability

✅ **Balanced Implementation:**
- **Frontend:** Vite, Lit components, Three.js, Web APIs
- **Backend:** Express, LangChain, MCP, Azure OpenAI
- **Infrastructure:** Azure services, IaC deployment

### **5. Adherence to Hackathon Category (20%)**

✅ **Grand Prize - Build AI Applications & Agents:**
- **Hero Tech:** Azure MCP ✓, Azure OpenAI ✓, Multi-Agent Framework ✓
- **Azure Deployment:** App Service ✓, Static Web Apps ✓, Bicep IaC ✓
- **Innovation:** First mental health app with multi-agent MCP architecture
- **Impact:** Addresses critical mental health crisis

✅ **Best Multi-Agent System:**
- 4 specialized agents with orchestration
- MCP-based agent-to-agent communication
- Sophisticated agent selection logic
- Context-aware agent prompts

✅ **Best Azure Integration:**
- Azure OpenAI (GPT-4o with audio)
- Azure App Service
- Azure Static Web Apps
- Infrastructure as Code (Bicep)
- Ready for AI Search, Content Safety, Cosmos DB, Key Vault, App Insights

---

## 🔧 TECHNICAL SPECIFICATIONS

### **Stack**

**Frontend:**
- Vite 6.0
- Lit 3.6 (Web Components)
- Three.js + @pixiv/three-vrm (3D Avatar)
- Web Speech API (Voice)
- Marked (Markdown rendering)

**Backend:**
- Node.js + Express 5.1
- LangChain.js (Memory management)
- OpenAI SDK (Azure OpenAI client)
- Multer (File uploads)
- PDF-Parse (Document processing)

**MCP Server:**
- Express 5.1
- @modelcontextprotocol/sdk 1.0.4
- Custom MCP protocol implementation

**Azure Services:**
- Azure OpenAI (GPT-4o)
- Azure App Service (Backend)
- Azure Static Web Apps (Frontend)
- Azure Developer CLI (azd)

**Development:**
- TypeScript 5.7
- ESM modules
- Git version control

### **Architecture Patterns**

- **Multi-Agent System:** Orchestrator + Specialized Agents
- **Model Context Protocol:** Standardized tool/resource access
- **RAG (Retrieval Augmented Generation):** Knowledge-grounded responses
- **Microservices:** MCP Server separate from API
- **Infrastructure as Code:** Bicep templates
- **Clean Architecture:** Separation of concerns

---

## 📈 METRICS & IMPACT

### **Current Capabilities**

- **4 Specialized Agents** for mental health support
- **5 MCP Tools** for intelligent decision-making
- **4 MCP Resource Collections** (50+ strategies, 8 conditions, 4 CBT techniques)
- **7 Emotion States** for avatar
- **Voice + Text** interaction modes
- **Session-based memory** (conversation continuity)
- **Multi-language crisis resources** (US, UK, CA, AU)

### **Potential Impact**

- **Accessibility:** Free, available 24/7 to anyone with internet
- **Crisis Prevention:** Immediate detection and resource provision
- **Evidence-Based:** CBT, mindfulness validated by research
- **Scalability:** Can serve unlimited users simultaneously
- **Privacy:** Anonymous, no registration required
- **Innovation:** First MCP multi-agent mental health system

### **Target Users**

- **Primary:** Individuals experiencing mental health challenges
- **Crisis:** People in suicidal crisis need immediate help
- **Students:** High stress, limited access to counseling
- **Underserved Populations:** Low income, rural, stigmatized communities
- **Complement to Therapy:** Between sessions, after-hours support

---

## 🎥 DEMO VIDEO SCRIPT

**[0:00-0:15]** Problem Statement
- "40% of adults struggle with mental health"
- "Mental health care is often inaccessible"
- "Crisis situations need immediate, expert responses"

**[0:15-0:30]** Solution Introduction
- "Meet VishAI - Multi-agent mental health support powered by Azure MCP"
- Show 4 agents: Crisis, CBT, Mindfulness, Companion
- "Intelligent orchestration routes you to the right expert"

**[0:30-0:50]** Crisis Detection Demo
- Type: "I'm feeling hopeless and want to end it"
- Show: MCP assess_crisis_level → SEVERE
- Show: Crisis Counselor Agent selected
- Response: Immediate 988 hotline, compassionate support
- Avatar emotions: Concern

**[0:50-1:10]** CBT Therapist Demo
- Type: "I can't stop overthinking and catastrophizing"
- Show: CBT Therapist Agent selected
- Show: MCP get_cbt_technique for thought-challenging
- Response: Step-by-step cognitive restructuring guide
- Avatar emotion: Thoughtful

**[1:10-1:30]** Mindfulness Coach Demo
- Type: "I'm having a panic attack, can't breathe"
- Show: Mindfulness Coach selected
- Show: MCP recommend_coping_strategies (immediate)
- Response: Guided 4-7-8 breathing exercise in real-time
- Avatar emotion: Calm
- Switch to voice mode, show lip sync

**[1:30-1:50]** Azure Technologies Highlight
- **Azure MCP:** Show MCP server with resources/tools
- **Azure OpenAI:** Show GPT-4o with audio
- **Multi-Agent Orchestration:** Show agent selection flow
- **Azure Infrastructure:** Show Bicep deployment

**[1:50-2:00]** Impact Statement
- "24/7 mental health support for everyone"
- "Evidence-based, specialized, compassionate"
- "Built with Microsoft AI Platform"
- GitHub: [repo link]

---

## 🚀 DEPLOYMENT INSTRUCTIONS

### **Prerequisites**

- Azure subscription
- Azure CLI installed
- Azure Developer CLI (azd) installed
- Node.js 18+ and npm
- Git

### **Environment Variables**

Create `.env` in `packages/webapi/`:

```env
AZURE_INFERENCE_SDK_KEY=your_key
INSTANCE_NAME=your_instance
DEPLOYMENT_NAME=gpt-4o
MCP_SERVER_URL=http://localhost:3001
PORT=3000
```

### **Local Development**

```bash
# Clone repository
git clone https://github.com/ToshikSoni/JS-AI_VishAI
cd JS-AI_VishAI
git checkout Avatar  # Use Avatar branch with multi-agent system

# Install dependencies
cd packages/mcp-server && npm install && cd ../..
cd packages/webapi && npm install && cd ../..
cd packages/webapp && npm install && cd ../..

# Start MCP Server (Terminal 1)
cd packages/mcp-server
npm start

# Start API Server (Terminal 2)
cd packages/webapi
npm start

# Start Frontend (Terminal 3)
cd packages/webapp
npm run dev
```

### **Azure Deployment**

```bash
# Login to Azure
az login
azd auth login

# Initialize azd (first time)
azd init

# Deploy to Azure
azd up

# Follow prompts to select subscription, region, resource names
```

### **Post-Deployment**

1. Configure environment variables in Azure App Service
2. Restart services
3. Test health endpoints:
   - API: `https://your-api.azurewebsites.net/health`
   - MCP: `https://your-mcp.azurewebsites.net/health`

---

## 🔮 FUTURE ENHANCEMENTS

### **Production-Ready Features**

1. **Azure AI Search:** Semantic search with embeddings
2. **Azure AI Content Safety:** Advanced content filtering
3. **Azure Cosmos DB:** Persistent conversation storage
4. **Azure Blob Storage:** User document storage
5. **Azure Key Vault:** Secure credential management
6. **Azure Application Insights:** Monitoring and analytics
7. **Azure AD B2C:** User authentication
8. **Azure Functions:** Serverless background jobs

### **Advanced AI Features**

1. **Sentiment Analysis:** Track mood over time (Azure Text Analytics)
2. **Multi-Language Support:** Azure Translator
3. **Therapist Handoff:** Connect to real professionals
4. **Goal Tracking:** AI-powered progress monitoring
5. **Journal Analysis:** Insights from user writings
6. **Group Therapy:** Multi-user agent sessions

### **Enterprise Features**

1. **HIPAA Compliance:** Healthcare data protection
2. **SSO Integration:** Enterprise authentication
3. **Audit Logging:** Compliance and security
4. **Data Retention Policies:** Configurable storage
5. **Custom Agent Training:** Organization-specific knowledge
6. **White-Label Deployment:** For healthcare providers

---

## 📚 RESOURCES

### **Documentation**

- [Azure MCP Documentation](https://learn.microsoft.com/azure/ai-services/mcp)
- [Azure OpenAI Service](https://learn.microsoft.com/azure/ai-services/openai/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [LangChain.js Documentation](https://js.langchain.com/)

### **Crisis Resources**

- **988 Suicide & Crisis Lifeline:** Call/Text 988
- **Crisis Text Line:** Text HOME to 741741
- **International:** https://findahelpline.com/

---

## 👥 TEAM

- **Developer:** Toshik Soni
- **Project:** VishAI - AI Mental Health Companion
- **Hackathon:** AI Dev Days Hackathon
- **Date:** February 2026

---

## 📄 LICENSE

AGPL-3.0

---

## 🙏 ACKNOWLEDGMENTS

- **Microsoft AI Dev Days** for inspiration
- **Azure AI Platform** team for incredible tools
- Mental health professionals for domain expertise
- Open source community for frameworks and libraries

---

**Built with ❤️ using Microsoft AI Platform**

**GitHub:** https://github.com/ToshikSoni/JS-AI_VishAI (Avatar branch)
