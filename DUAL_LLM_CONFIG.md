# Dual LLM Deployment Configuration

VishAI uses **two separate LLM deployments** to optimize for different interaction modes:

## 🗣️ Text Chat vs Voice Chat

### Text Chat Deployment (`/chat` endpoint)
- **Used for:** Regular text-based chat interactions
- **Model:** GPT-4o or GPT-5 (text-only, no audio modalities)
- **Environment Variable:** `TEXT_DEPLOYMENT_NAME`
- **Benefits:**
  - Faster response times for text
  - Lower latency
  - More cost-effective for text-only interactions
  - Better suited for longer responses and complex reasoning

### Voice Chat Deployment (`/chat-audio` endpoint)
- **Used for:** Voice interactions with audio input/output
- **Model:** GPT-4o-audio (with audio modalities enabled)
- **Environment Variable:** `AUDIO_DEPLOYMENT_NAME`
- **Benefits:**
  - Native audio generation with natural voice
  - Voice modulation for emotional expression
  - Better suited for conversational, concise responses
  - Synchronized audio and text output

## 🔧 Configuration

### Option 1: Separate Deployments (Recommended)

If you have separate Azure OpenAI deployments:

```bash
# .env configuration
DEPLOYMENT_NAME=gpt-4o                    # Fallback/default
TEXT_DEPLOYMENT_NAME=gpt-4o               # Text chat deployment
AUDIO_DEPLOYMENT_NAME=gpt-4o-audio        # Audio chat deployment
```

### Option 2: Single Deployment (Fallback)

If you only have one deployment, the system will use it for both:

```bash
# .env configuration
DEPLOYMENT_NAME=gpt-4o                    # Used for both text and audio
# TEXT_DEPLOYMENT_NAME not set - falls back to DEPLOYMENT_NAME
# AUDIO_DEPLOYMENT_NAME not set - falls back to DEPLOYMENT_NAME
```

## 🤖 Multi-Agent System Integration

Both text and audio endpoints use the **same agent orchestration system**:

- **🚨 Crisis Counselor Agent** - Crisis intervention
- **🧠 CBT Therapist Agent** - Cognitive behavioral therapy
- **🧘 Mindfulness Coach Agent** - Breathing & meditation
- **💙 Companion Agent** - General support

The orchestrator intelligently routes messages to the appropriate agent regardless of interaction mode (text or voice).

## 📊 How It Works

```
User Message
    ↓
[Text Mode?]──YES──→ textClient (TEXT_DEPLOYMENT_NAME) ──┐
    ↓                                                      │
    NO                                                     │
    ↓                                                      ↓
[Voice Mode]────────→ audioClient (AUDIO_DEPLOYMENT_NAME) → Agent Orchestrator
                                                           ↓
                                              Select Agent (Crisis/CBT/Mindfulness/Companion)
                                                           ↓
                                              Query MCP Server for Knowledge
                                                           ↓
                                              Generate Response with Azure OpenAI
                                                           ↓
                                              Return with Agent Metadata & Emotion
```

## 🎯 Response Optimization

### Text Mode
- **Format:** Text only (markdown formatted)
- **Length:** Can be longer and more detailed
- **Style:** Therapeutic, professional, informative
- **Emotion:** Conveyed through language choice
- **Agent Visibility:** Shows agent badge in UI

### Voice Mode
- **Format:** Audio + transcript
- **Length:** Shorter, conversational (2-4 sentences)
- **Style:** Warm, empathetic, spoken-word friendly
- **Emotion:** Conveyed through voice tone and pacing
- **Voice:** "Sage" voice (calm, wise, reassuring)
- **Agent Visibility:** Shows agent badge + audio waveform

## 🔄 Session Continuity

Both endpoints share:
- **Conversation memory** - LangChain BufferMemory per session
- **Agent history** - Track which agents were used
- **User context** - Maintain user profile across interactions
- **Crisis detection** - Same crisis keywords and MCP assessment

This ensures seamless transitions between text and voice within the same conversation.

## 📦 Azure Deployment Configuration

When deploying to Azure, configure both deployments:

```bash
# Azure CLI example
# Create text deployment
az cognitiveservices account deployment create \
  --name your-openai-resource \
  --resource-group your-rg \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --sku-capacity 10

# Create audio deployment
az cognitiveservices account deployment create \
  --name your-openai-resource \
  --resource-group your-rg \
  --deployment-name gpt-4o-audio \
  --model-name gpt-4o-realtime-preview \
  --model-version "2024-10-01-preview" \
  --sku-capacity 10
```

## 🧪 Testing

### Test Text Chat
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I feel anxious",
    "sessionId": "test-session"
  }'

# Should use TEXT_DEPLOYMENT_NAME
# Response includes agent metadata
```

### Test Voice Chat
```bash
curl -X POST http://localhost:3000/chat-audio \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need help with breathing",
    "sessionId": "test-session"
  }'

# Should use AUDIO_DEPLOYMENT_NAME
# Response includes audioData field
```

## 💡 Cost Optimization

Separate deployments allow you to:
- Use different pricing tiers per deployment
- Scale text and audio independently
- Monitor usage separately
- Optimize for different usage patterns

---

**Note:** The system gracefully falls back to a single deployment if you don't configure separate deployments. This makes it easy to start with one deployment and scale to two as your needs grow.
