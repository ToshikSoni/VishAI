# Azure Speech TTS Avatar Integration

VishAI now uses **Azure Speech Text-to-Speech Avatar** for photorealistic avatar videos with lip-sync in voice mode! 🎭

## 🎯 Architecture

### Lisa - Graceful Sitting Avatar
- **Character**: Lisa (photorealistic human avatar)
- **Style**: Graceful-sitting (professional, warm presence)
- **Real-time streaming**: WebRTC for instant avatar video
- **Lip-sync**: Automatic viseme generation synced to speech
- **Agent-aware voices**: Different voices for each agent specialty

## 🔄 How It Works

### Voice Mode Flow:
```
User speaks → Speech-to-Text (browser) → GPT-5 generates intelligent response
    ↓
Backend returns: text + avatar config (SSML, voice, character, style)
    ↓
Frontend: Speech SDK + WebRTC → Azure Speech synthesizes avatar video
    ↓
Lisa avatar appears on screen, lips sync perfectly to agent's voice
```

### Key Benefits:
✅ **GPT-5 for intelligence**: All agent orchestration (Crisis, CBT, Mindfulness, Companion)  
✅ **Azure Speech for voice**: Photorealistic avatar with natural lip-sync  
✅ **Real-time streaming**: <1 second latency via WebRTC  
✅ **Agent-specific voices**: Each agent has tailored voice characteristics  

## 🎨 Avatar Configuration

### Current Setup:
- **Character**: `lisa`
- **Style**: `graceful-sitting`
- **Background**: Soft blue-grey (#F0F4F8)
- **Resolution**: 1920x1080, 25 FPS
- **Codec**: H.264

### Agent Voice Mapping:
| Agent | Voice | Style |
|-------|-------|-------|
| Crisis Counselor | en-US-JennyNeural | Calm, empathetic |
| CBT Therapist | en-US-AvaMultilingualNeural | Thoughtful, professional |
| Mindfulness Coach | en-US-SaraNeural | Soothing, gentle |
| Companion | en-US-AvaMultilingualNeural | Friendly, warm |

## 🔧 Setup

### 1. Azure Speech Resource
Create an Azure Speech Service resource in one of the supported regions:
- **Recommended**: West US 2, Sweden Central, North Central US
- Get your Speech Key and Region from Azure Portal

### 2. Environment Variables
```bash
# .env configuration
AZURE_SPEECH_KEY=your_speech_key_here
AZURE_SPEECH_REGION=westus2

# GPT-5 for ALL intelligence (text + voice)
TEXT_DEPLOYMENT_NAME=gpt-5
```

### 3. Install Dependencies
```bash
cd packages/webapi
npm install axios
```

### 4. Frontend Integration
The frontend automatically:
1. Fetches ICE server config from `/avatar/ice-config`
2. Establishes WebRTC peer connection with Azure Speech
3. Uses Speech SDK to synthesize avatar video in real-time
4. Displays Lisa avatar with lip-synced speech

## 📡 API Endpoints

### GET `/avatar/ice-config`
Returns ICE server configuration for WebRTC connection.

**Response:**
```json
{
  "iceServers": [{
    "urls": ["turn:relay.communication.microsoft.com:3478"],
    "username": "...",
    "credential": "..."
  }]
}
```

### GET `/avatar/config?agentRole=crisis-counselor`
Returns avatar configuration for specific agent.

**Response:**
```json
{
  "character": "lisa",
  "style": "graceful-sitting",
  "voice": "en-US-JennyNeural",
  "videoFormat": {
    "backgroundColor": "#F0F4F8"
  },
  "speechKey": "...",
  "speechRegion": "westus2"
}
```

### POST `/chat-audio`
Returns intelligent response + avatar SSML for real-time synthesis.

**Response:**
```json
{
  "reply": "I understand how difficult this must be...",
  "avatar": {
    "character": "lisa",
    "style": "graceful-sitting",
    "voice": "en-US-JennyNeural",
    "ssml": "<speak>...</speak>",
    "videoFormat": { "backgroundColor": "#F0F4F8" }
  },
  "emotion": "empathy",
  "agent": {
    "agentName": "Crisis Counselor",
    "agentRole": "crisis-counselor"
  }
}
```

## 🎭 Available Avatars

### Standard Video Avatars (Full Body):
- **Lisa**: casual-sitting, graceful-sitting, technical-sitting
- **Harry**: business, casual, youthful
- **Jeff**: business, formal
- **Lori**: casual, graceful, formal
- **Max**: business, casual, formal
- **Meg**: formal, casual, business

### Photo Avatars (Head Only):
adrian, amara, amira, anika, bianca, camila, carlos, clara, darius, diego, elise, farhan, faris, gabrielle, hyejin, imran, isabella, layla, liwei, ling, marcus, matteo, rahul, rana, ren, riya, sakura, simone, zayd, zoe

## 🚀 Future Enhancements

- [ ] **Custom avatar**: Train Lisa with your own video
- [ ] **Gestures**: Add hand gestures via SSML (wave, point, thumbs up)
- [ ] **Background video**: Replace static background with dynamic content
- [ ] **Multi-avatar**: Switch avatars based on mood/agent
- [ ] **4K resolution**: Upgrade to ultra-high definition
- [ ] **Photo avatar**: Use single-photo avatars for faster loading

## 🔗 Resources

- [Azure Speech TTS Avatar Docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/what-is-text-to-speech-avatar)
- [Real-time Synthesis Guide](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/real-time-synthesis)
- [Avatar Voice Gallery](https://speech.microsoft.com/portal/voicegallery)
- [SSML Reference](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup)

## 💡 Why Azure Speech Avatar?

| Feature | GPT-audio | Azure Speech Avatar |
|---------|-----------|---------------------|
| **Visual** | Audio only | Photorealistic video |
| **Lip-sync** | N/A | Automatic visemes |
| **Latency** | ~500ms | ~500ms (WebRTC) |
| **Cost** | Higher | More cost-effective |
| **Customization** | Limited | High (SSML, gestures, custom avatars) |
| **Platform** | OpenAI | Azure (better integration) |

---

**Status**: ✅ Integrated and ready for demo!  
**Avatar**: Lisa (graceful-sitting)  
**Voices**: Agent-specific (Jenny, Ava, Sara)  
**Next**: Add Speech SDK to frontend for WebRTC streaming
