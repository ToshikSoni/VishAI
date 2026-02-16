# Vish AI: 24/7 Mental Health Companion Built with GitHub Copilot CLI
*This is a submission for the [GitHub Copilot CLI Challenge](https://dev.to/challenges/github-2026-01-21)*

---
## What I Built

Vish AI — a multi-agent mental health companion that's available when you actually need it.

332 million people worldwide deal with depression. Suicide is the third leading cause of death for 15–29 year olds. Traditional therapy has month-long waitlists and runs $100–250 per session. Crisis hotlines only help during emergencies. Mental health apps? 70–75% abandoned within 100 days.

Vish AI tackles this with 4 specialized AI agents — a Crisis Counselor, CBT Therapist, Mindfulness Coach, and Conversational Companion — that dynamically route to the right specialist based on what you're going through. It learns from your journals, medical records, and personal history to provide context-aware, personalized support. Text or voice, whenever you need it.

### Key Features

#### Multi-Agent Intelligence

- 4 specialized agents with automatic routing: Crisis Counselor (🚨), CBT Therapist (🧠), Mindfulness Coach (🧘), Companion (💙)

- Agent badges show you exactly which specialist is responding — full transparency

- Agents are mutually aware and suggest handoffs when appropriate

#### 3D Avatar Companions with Real-Time Lip Sync

- 3 selectable VRM avatars (Ava, Luna, Kai) rendered in Three.js

- Real-time lip sync driven by Web Audio API frequency analysis — avatar mouths move in sync with AI speech

- Emotion-reactive facial expressions based on response sentiment

- Automatic blinking, idle breathing, head sway, and wave greeting on load

#### Azure AI Avatar

- Microsoft's photorealistic Text-to-Speech Avatar streamed via WebRTC
6 characters with natural lip sync and body language

- 6 characters with multiple natural lip sync voices and body language

#### Voice Conversation Mode

- Full hands-free with speech recognition and Azure OpenAI audio

- Barge-in support — interrupt anytime

- Continuous flow with auto resume

#### RAG + Personal Document Upload

- Built-in mental health resources + your own PDFs, journals, medical records

- Source attribution on every response

#### MCP Server (Model Context Protocol)

- Standalone server with 5 tools and 4 resource collections

- Real-time crisis assessment (3-tier severity + confidence)

- Structured CBT delivery and topic search

#### Crisis Safety System

- Keyword detection on every message

- MCP-powered severity scoring

- Auto crisis modal with country-specific hotlines

- Graceful fallback when Azure Content Safety blocks — never leaves the user hanging

#### Deep Personalization

- 13 profile fields

- Choose how Vish acts: friend, therapist, mentor, sibling, coach, confidant

- Avatar fully embodies the chosen personality, name, gender, and voice

**Important:** This is an LLM-powered tool. It makes mistakes. If you're in crisis, seek professional help immediately.

---
## Demo
GitHub: https://github.com/ToshikSoni/JS-AI_VishAI/

Try it out: [VishAI](https://gentle-ground-0e9b60d03.2.azurestaticapps.net)

**I had to remove the live demo because of the hosting cost. You can deploy the website and test it out on your own by providing the required API keys. You need to use Microsoft text-to-speech avatar service for real-time realistic avatar. Along with any chat based and voice based AI LLM.**

Video Demo for real-time avatar: 

https://github.com/user-attachments/assets/c109e843-8ea6-43fb-8ce5-0a392a65b6e9



Website Demo: 
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/f1q9ztlbhjw0dsxvrlrh.png)

Real-time avatars:
![Image description](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/eeov8edneeuslcl2u0u7.png)



---
## My Experience with GitHub Copilot CLI
GitHub Copilot CLI wasn't just a helper — it was a force multiplier. I lived in the terminal the entire build and it completely changed the pace.

**Where Copilot CLI made the biggest impact:**
- Multi-agent orchestration: I described the routing logic, priority escalation, and handoff system. It scaffolded the entire orchestrator, agent definitions, and mutual awareness in one go. What would've been a full day of architecture took an afternoon.

- MCP Server: Built the entire Model Context Protocol server (5 tools, 4 resource collections, REST protocol) from scratch. Copilot CLI nailed the tool schemas, crisis scoring algorithm, and client-server wiring.

- Real-time lip sync: Told it "analyze Web Audio API frequencies to drive VRM blend shapes for visemes." It gave me the full FFT analysis, band mapping, smoothing, and blend shape code. Feature that normally takes days was done in hours.

- Azure AI Avatar integration: WebRTC, ICE negotiation, Speech SDK flow — Copilot CLI generated the whole connection management, throttling, and error handling.

- RAG pipeline: Chunking strategy, scoring, prompt injection — all suggested and refined instantly.

- Azure deployment hell: When things broke, I pasted the errors and it diagnosed auth, CORS, Bicep syntax, and even fixed the docker-compose for local dev.

- Crisis safety fallback: Critical part — when Content Safety blocks, it can't fail silently. Copilot CLI designed the try-catch flow that auto-generates compassionate safety responses with resources.

**The development speed difference:**
Features that took 20–30 minutes each dropped to 5–10 minutes. Over 30+ complex features, that compounding let me ship something way more ambitious than I could've alone. Copilot CLI kept me in flow the entire time.
