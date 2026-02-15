# VishAI Hackathon - Quick Start Guide

## What We Built

A **multi-agent AI mental health support system** using **Azure MCP** (Model Context Protocol) with **4 specialized agents** that intelligently route and respond to user needs.

## Hero Technologies ✅

1. ✅ **Azure MCP** - Model Context Protocol server with 5 tools and 4 resource collections
2. ✅ **Microsoft Agent Framework** - Multi-agent orchestration with specialized agents
3. ✅ **Azure OpenAI** - GPT-4o with audio modalities
4. ✅ **Azure Infrastructure** - App Service, Static Web Apps, Bicep IaC

## Architecture

```
User Message
    ↓
Agent Orchestrator
    ├→ MCP: assess_crisis_level
    ├→ Select Agent (Crisis/CBT/Mindfulness/Companion)
    ├→ Get Agent Prompt + MCP Context
    └→ Azure OpenAI GPT-4o
        ↓
Specialized Response
```

## Agents

1. **🚨 Crisis Counselor** - Immediate crisis intervention, suicide prevention
2. **🧠 CBT Therapist** - Cognitive behavioral therapy techniques  
3. **🧘 Mindfulness Coach** - Breathing, meditation, grounding exercises
4. **💬 Companion** - General emotional support and listening

## Quick Start (Local)

### 1. Start MCP Server (Terminal 1)

```bash
cd packages/mcp-server
npm install
npm start
```

**Runs on:** http://localhost:3001

**Check health:** `curl http://localhost:3001/health`

### 2. Start API Server (Terminal 2) 

```bash
cd packages/webapi
npm start
```

**Runs on:** http://localhost:3000

**Check health:** `curl http://localhost:3000/health`

### 3. Start Frontend (Terminal 3)

```bash
cd packages/webapp
npm install
npm run dev
```

**Runs on:** http://localhost:5173

## Test the Multi-Agent System

### Test 1: Crisis Detection

**Message:** "I'm feeling hopeless and can't go on"

**Expected:**
- 🤖 Agent: **Crisis Counselor**
- ⚠️ MCP Tool: `assess_crisis_level` → SEVERE
- 📞 Response: Immediate 988 hotline + compassionate support
- 😟 Emotion: concern

### Test 2: CBT Request

**Message:** "I can't stop overthinking and having negative thoughts"

**Expected:**
- 🤖 Agent: **CBT Therapist**
- 🧠 MCP Tool: `search_mental_health_topics` + `get_cbt_technique`
- 📚 Response: Thought-challenging technique with steps
- 🤔 Emotion: thoughtful

### Test 3: Panic/Anxiety

**Message:** "I'm having a panic attack, can't breathe"

**Expected:**
- 🤖 Agent: **Mindfulness Coach**
- 🧘 MCP Tool: `recommend_coping_strategies` (immediate)
- 🌬️ Response: Guided 4-7-8 breathing exercise
- 😌 Emotion: calm

### Test 4: General Support

**Message:** "I've been feeling stressed about work lately"

**Expected:**
- 🤖 Agent: **Companion**
- 💬 MCP Tool: `search_mental_health_topics` (stress)
- ❤️ Response: Empathetic listening + general coping strategies
- 🤗 Emotion: empathy

## MCP Server API

### Resources

```bash
# List all resources
curl http://localhost:3001/mcp/resources

# Get crisis resources
curl http://localhost:3001/mcp/resources/crisis-resources

# Get CBT techniques
curl http://localhost:3001/mcp/resources/cbt-techniques

# Get coping strategies
curl http://localhost:3001/mcp/resources/coping-strategies

# Get mental health topics
curl http://localhost:3001/mcp/resources/mental-health-topics
```

### Tools

```bash
# List all tools
curl http://localhost:3001/mcp/tools

# Call assess_crisis_level tool
curl -X POST http://localhost:3001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "assess_crisis_level", "arguments": {"message": "I want to die"}}'

# Call get_crisis_resources tool
curl -X POST http://localhost:3001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "get_crisis_resources", "arguments": {"country": "US"}}'

# Call search_mental_health_topics tool
curl -X POST http://localhost:3001/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "search_mental_health_topics", "arguments": {"query": "anxiety", "limit": 3}}'
```

## What Makes This Special for the Hackathon

### 1. **Azure MCP Integration** (Hero Tech ✅)

- Full MCP server implementation exposing mental health knowledge
- 5 MCP tools agents can call
- 4 MCP resource collections
- Agent-to-agent (A2A) communication pattern

### 2. **Multi-Agent Orchestration** (Hero Tech ✅)

- 4 specialized agents with distinct expertise
- Intelligent routing based on MCP crisis assessment
- Agent-specific system prompts with MCP context
- Seamless handoffs between agents

### 3. **Real-World Impact**

- Addresses mental health crisis (40% of adults affected)
- Crisis detection and immediate resource provision
- Evidence-based techniques (CBT, mindfulness)
- 24/7 availability, accessible to anyone

### 4. **Production-Ready Architecture**

- Deployed on Azure (App Service + Static Web Apps)
- Infrastructure as Code (Bicep templates)
- Scalable microservices architecture
- Graceful degradation when MCP unavailable

## File Structure

```
packages/
├── mcp-server/                 # Azure MCP Server
│   ├── index.js               # MCP protocol implementation
│   ├── knowledge-base.js      # Mental health education
│   ├── crisis-resources.js    # Emergency hotlines & protocols
│   ├── coping-strategies.js   # Evidence-based strategies
│   ├── cbt-techniques.js      # CBT methods with steps
│   └── package.json
│
├── webapi/                     # Main API Server
│   ├── server.js              # Express server with orchestrator
│   ├── agents/
│   │   ├── orchestrator.js    # Agent selection & coordination
│   │   ├── agent-definitions.js  # 4 specialized agents
│   │   └── mcp-client.js      # MCP HTTP client
│   └── package.json
│
└── webapp/                     # Frontend
    ├── src/
    │   ├── components/
    │   │   └── chat.js        # Chat UI
    │   └── main.js
    └── package.json
```

## Branches

- **`main`** - Production version at "cost efficient" commit (no avatar, no multi-agent)
- **`Avatar`** - Hackathon version with:
  - Multi-agent system with orchestrator
  - Azure MCP integration
  - Voice interaction

## Next Steps for Submission

1. ✅ **Working Project** - Multi-agent system operational
2. ⏳ **Demo Video** - Record 2-minute demo (see script in HACKATHON.md)
3. ⏳ **Architecture Diagram** - Create visual diagram
4. ⏳ **README Update** - Add hero technologies prominently
5. ⏳ **Public Repository** - Ensure Avatar branch is public

## Environment Variables Needed

```env
# packages/webapi/.env
AZURE_INFERENCE_SDK_KEY=your_azure_openai_key
INSTANCE_NAME=your_instance_name
DEPLOYMENT_NAME=gpt-4o
MCP_SERVER_URL=http://localhost:3001
PORT=3000
```

## Troubleshooting

### MCP Server not connecting

**Check:** 
```bash
curl http://localhost:3001/health
```

**Fix:** Make sure MCP server is running first

### Agent not showing in response

**Check console logs for:**
```
🤖 Selected Agent: [Agent Name]
```

**Verify:** server.js has orchestrator integration

## Support

For issues or questions:
- Check HACKATHON.md for full documentation
- See code comments for implementation details

---

**Ready to demo! 🚀**

Built with ❤️ using Microsoft AI Platform
