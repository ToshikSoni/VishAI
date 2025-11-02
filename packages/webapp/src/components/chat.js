import { LitElement, html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import {
  loadMessages,
  saveMessages,
  clearMessages,
} from "../utils/chatStore.js";
import { formatMarkdown } from "../utils/markdownFormatter.js";
import { API_URL } from "../config/api.js";
import "./chat.css";

export class ChatInterface extends LitElement {
  static get properties() {
    return {
      messages: { type: Array },
      inputMessage: { type: String },
      isLoading: { type: Boolean },
      isRetrieving: { type: Boolean },
      ragEnabled: { type: Boolean },
      showCrisisResources: { type: Boolean },
      crisisResources: { type: Array },
      talkModeActive: { type: Boolean },
      isListening: { type: Boolean },
      isSpeaking: { type: Boolean },
      talkModeSupported: { type: Boolean },
      speechError: { type: String },
      sidebarOpen: { type: Boolean },
      userInfo: { type: Object },
      activeTab: { type: String },
      userDocuments: { type: Array },
      isUploadingDoc: { type: Boolean },
      historySidebarOpen: { type: Boolean },
      chatSessions: { type: Array },
      currentChatId: { type: String },
    };
  }

  constructor() {
    super();
    this.messages = [];
    this.inputMessage = "";
    this.isLoading = false;
    this.isRetrieving = false;
    this.ragEnabled = true; // Enable RAG by default
    this.showCrisisResources = false;
    this.crisisResources = [];
    this.talkModeActive = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.talkModeSupported = false;
    this.speechError = "";
    this.sessionId = this._generateSessionId();
    this.recognition = null;
    this.currentUtterance = null;
    this.currentAudio = null;
    this.bargeInTimer = null;
    this.sidebarOpen = false;
    this.activeTab = "personal"; // 'personal' or 'documents'
    this.userDocuments = this._loadUserDocuments();
    this.isUploadingDoc = false;
    this.userInfo = this._loadUserInfo();
    this.historySidebarOpen = false;
    this.chatSessions = this._loadChatSessions();
    this.currentChatId = this._getCurrentChatId();
  }

  // Create a unique session ID for this conversation
  _generateSessionId() {
    return (
      "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
    );
  }

  // Render into light DOM so external CSS applies
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Load chat history from localStorage when component is added to the DOM
    this.messages = loadMessages();

    // Show welcome message if no history
    if (this.messages.length === 0) {
      this._addWelcomeMessage();
    }

    // Add Google Font for Quicksand
    this._addGoogleFont();
    this._initializeSpeech();
  }

  disconnectedCallback() {
    this._stopListening();
    this._stopSpeaking();
    super.disconnectedCallback();
  }

  _addGoogleFont() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }

  _addWelcomeMessage() {
    const welcomeMessage = {
      role: "assistant",
      content:
        "Hello there! I'm Vish, your friendly AI companion. I'm here to support you and provide a safe space for us to chat about whatever is on your mind. How are you feeling today? Remember, it's okay to not be okay, and I'm here to listen.",
      isWelcome: true,
    };
    this.messages = [welcomeMessage];
    saveMessages(this.messages);
  }

  updated(changedProps) {
    // Save chat history to localStorage whenever messages change
    if (changedProps.has("messages")) {
      saveMessages(this.messages);
      this._saveCurrentChat(); // Also save to chat sessions

      // Scroll to the bottom of the chat
      const chatMessages = this.querySelector(".chat-messages");
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }

  render() {
    return html`
      <div class="app-wrapper">
        <!-- Sidebar -->
        <div class="sidebar ${this.sidebarOpen ? "open" : ""}">
          <div class="sidebar-header">
            <h3>
              ${this.activeTab === "personal"
                ? "Personal Information"
                : "My Documents"}
            </h3>
            <button
              class="sidebar-close-btn"
              @click=${this._toggleSidebar}
              aria-label="Close Sidebar"
            >
              ✕
            </button>
          </div>

          <!-- Sidebar Tabs -->
          <div class="sidebar-tabs">
            <button
              class="tab-btn ${this.activeTab === "personal" ? "active" : ""}"
              @click=${() => this._switchTab("personal")}
            >
              👤 Personal Info
            </button>
            <button
              class="tab-btn ${this.activeTab === "documents" ? "active" : ""}"
              @click=${() => this._switchTab("documents")}
            >
              📄 Documents
            </button>
          </div>

          <div class="sidebar-content">
            ${this.activeTab === "personal"
              ? this._renderPersonalInfoTab()
              : this._renderDocumentsTab()}
          </div>
        </div>

        <!-- Overlay for mobile -->
        ${this.sidebarOpen
          ? html`
              <div class="sidebar-overlay" @click=${this._toggleSidebar}></div>
            `
          : ""}

        <!-- Top Navigation Bar -->
        <div class="top-nav">
          <div class="nav-left">
            <button
              class="sidebar-toggle-btn"
              @click=${this._toggleSidebar}
              aria-label="Toggle Sidebar"
            >
              <span class="hamburger-icon">☰</span>
            </button>
            <h1 class="app-title">Vish AI 💚</h1>
          </div>
          <div class="nav-right">
            <label class="rag-toggle">
              <input
                type="checkbox"
                ?checked=${this.ragEnabled}
                @change=${this._toggleRag}
              />
              <span class="toggle-label">Use Supportive Resources</span>
            </label>
            <button class="clear-chat-btn" @click=${this._clearChat}>
              🆕 Start New Chat
            </button>
            <button class="history-btn" @click=${this._toggleHistorySidebar}>
              📜 History
            </button>
          </div>
        </div>

        <div class="chat-container">
          <!-- Crisis Resources Modal -->
          ${this.showCrisisResources
            ? html`
                <div class="modal-overlay" @click=${this._closeCrisisModal}>
                  <div
                    class="crisis-modal"
                    @click=${(e) => e.stopPropagation()}
                  >
                    <div class="modal-header">
                      <h3>🆘 Help is Always Available</h3>
                      <button
                        class="close-modal-btn"
                        @click=${this._closeCrisisModal}
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>
                    <div class="modal-content">
                      <p class="crisis-intro">
                        You're not alone. Here are immediate resources that can
                        help:
                      </p>
                      <ul class="crisis-list">
                        ${this.crisisResources.map(
                          (resource) => html`
                            <li>
                              <strong>${resource.name}</strong>
                              ${resource.contact
                                ? html`<div class="resource-contact">
                                    ${resource.contact}
                                  </div>`
                                : ""}
                              ${resource.url
                                ? html`<div>
                                    <a
                                      href="${resource.url}"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      >${resource.url}</a
                                    >
                                  </div>`
                                : ""}
                            </li>
                          `
                        )}
                      </ul>
                      <p class="crisis-note">
                        <strong>⚠️ Emergency:</strong> If you're feeling unsafe
                        right now, please call emergency services (911 in the
                        US) or reach out to someone you trust immediately.
                      </p>
                    </div>
                    <div class="modal-footer">
                      <button
                        class="close-btn"
                        @click=${this._closeCrisisModal}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              `
            : ""}

          <div class="chat-messages">
            ${this.messages.map(
              (message) => html`
                <div
                  class="message ${message.role === "user"
                    ? "user-message"
                    : "ai-message"} ${message.isWelcome
                    ? "welcome-message"
                    : ""}"
                >
                  <div class="message-content">
                    <span class="message-sender"
                      >${message.role === "user" ? "👤 You" : "💚 Vish"}</span
                    >
                    <div class="message-text">
                      ${unsafeHTML(formatMarkdown(message.content))}
                    </div>
                    ${this.ragEnabled &&
                    message.sources &&
                    message.sources.length > 0
                      ? html`
                          <details class="sources">
                            <summary>📚 Resources I'm Drawing From</summary>
                            <div class="sources-content">
                              ${message.sources.map(
                                (source) => html`<p>${source}</p>`
                              )}
                            </div>
                          </details>
                        `
                      : ""}
                  </div>
                </div>
              `
            )}
            ${this.isRetrieving
              ? html`
                  <div class="message system-message">
                    <p>📚 Finding helpful resources for you...</p>
                  </div>
                `
              : ""}
            ${this.isLoading && !this.isRetrieving
              ? html`
                  <div class="message ai-message thinking">
                    <div class="message-content">
                      <span class="message-sender">Vish</span>
                      <p>
                        <span class="typing-indicator"
                          >Thinking<span>.</span><span>.</span
                          ><span>.</span></span
                        >
                      </p>
                    </div>
                  </div>
                `
              : ""}
          </div>

          <div class="chat-input-container">
            <input
              type="text"
              class="chat-input"
              placeholder="Share your thoughts..."
              .value=${this.inputMessage}
              @input=${this._handleInput}
              @keyup=${this._handleKeyUp}
            />
            <button
              class="talk-mode-btn ${this.talkModeActive ? "active" : ""} ${this
                .isSpeaking
                ? "speaking"
                : ""}"
              @click=${this._toggleTalkMode}
              ?disabled=${!this.talkModeSupported}
              aria-pressed=${this.talkModeActive}
              title="${this.talkModeActive
                ? this.isSpeaking
                  ? "Speaking"
                  : "Listening"
                : "Talk Mode"}"
            >
              ${this.isSpeaking
                ? html`
                    <div class="audio-bars-small">
                      <div class="bar"></div>
                      <div class="bar"></div>
                      <div class="bar"></div>
                      <div class="bar"></div>
                      <div class="bar"></div>
                    </div>
                  `
                : html`
                    <span class="mic-icon"
                      >${this.talkModeActive ? "🎤" : "🎙️"}</span
                    >
                  `}
            </button>
            <button
              class="send-button"
              @click=${(e) => {
                e.preventDefault();
                this._sendMessage();
              }}
              ?disabled=${this.isLoading || !this.inputMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>

        <div class="app-footer">
          <p class="disclaimer">
            This is an AI LLM not a professional therapist. Kindly consult a
            professional for serious issues.
          </p>
          ${!this.talkModeSupported
            ? html`<p class="speech-warning">
                Speech features unavailable in this browser.
              </p>`
            : ""}
          ${this.speechError
            ? html`<p class="speech-warning">${this.speechError}</p>`
            : ""}
        </div>

        <!-- History Sidebar -->
        <div class="history-sidebar ${this.historySidebarOpen ? "open" : ""}">
          <div class="history-header">
            <h3>💬 Chat History</h3>
            <button
              class="sidebar-close-btn"
              @click=${this._toggleHistorySidebar}
              aria-label="Close History"
            >
              ✕
            </button>
          </div>

          <div class="history-content">
            ${this.chatSessions.length === 0
              ? html`
                  <p class="no-history">
                    No chat history yet. Start a conversation!
                  </p>
                `
              : html`
                  <div class="history-actions">
                    <button
                      class="delete-all-btn"
                      @click=${this._deleteAllChats}
                    >
                      🗑️ Delete All
                    </button>
                  </div>
                  <ul class="history-list">
                    ${this.chatSessions.map(
                      (session) => html`
                        <li
                          class="history-item ${session.id ===
                          this.currentChatId
                            ? "active"
                            : ""}"
                          @click=${() => this._loadChatSession(session.id)}
                        >
                          <div class="history-item-content">
                            <span class="history-title">${session.title}</span>
                            <span class="history-timestamp"
                              >📅
                              ${this._formatDateTime(session.createdAt)}</span
                            >
                            <span class="history-messages"
                              >${session.messages.length} messages</span
                            >
                          </div>
                          <div class="history-actions-btns">
                            <button
                              class="history-edit-btn"
                              @click=${(e) => this._renameChat(session.id, e)}
                              title="Rename chat"
                            >
                              ✏️
                            </button>
                            <button
                              class="history-delete-btn"
                              @click=${(e) => this._deleteChat(session.id, e)}
                              title="Delete chat"
                            >
                              🗑️
                            </button>
                          </div>
                        </li>
                      `
                    )}
                  </ul>
                `}
          </div>
        </div>

        <!-- History Overlay for mobile -->
        ${this.historySidebarOpen
          ? html`
              <div
                class="history-overlay"
                @click=${this._toggleHistorySidebar}
              ></div>
            `
          : ""}
      </div>
    `;
  }

  _toggleRag(e) {
    this.ragEnabled = e.target.checked;
  }

  _closeCrisisModal() {
    this.showCrisisResources = false;
    this.requestUpdate();
  }

  _toggleTalkMode() {
    if (!this.talkModeSupported) {
      return;
    }

    this.talkModeActive = !this.talkModeActive;
    this.speechError = "";

    if (this.talkModeActive) {
      this._startListening();
    } else {
      this._stopListening();
      this._stopSpeaking();
    }
  }

  // Clear chat history and start fresh
  _clearChat() {
    this._startNewChat();
    this._stopSpeaking();

    // Clear the server-side memory as well
    fetch(API_URL + "/clear-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch((error) => {
      console.error("Failed to clear server memory:", error);
    });
  }

  // Update inputMessage state as the user types
  _handleInput(e) {
    this.inputMessage = e.target.value;
  }

  // Send message on Enter key if not loading
  _handleKeyUp(e) {
    if (e.key === "Enter" && this.inputMessage.trim() && !this.isLoading) {
      this._sendMessage();
    }
  }

  // Handle sending a message and receiving a response
  async _sendMessage(messageOverride = null, options = {}) {
    const outgoing = (messageOverride ?? this.inputMessage).trim();
    if (!outgoing || this.isLoading) {
      return;
    }

    // Add user's message to the chat
    const userMessage = {
      role: "user",
      content: outgoing,
      viaSpeech: !!options.fromSpeech,
    };

    this.messages = [...this.messages, userMessage];
    if (messageOverride === null) {
      this.inputMessage = "";
    }
    this.isLoading = true;

    try {
      // Call API for response
      const aiResponse = await this._apiCall(outgoing);

      console.log("📨 API Response:", {
        hasReply: !!aiResponse.reply,
        replyLength: aiResponse.reply?.length,
        hasAudio: !!aiResponse.audioData,
        talkMode: this.talkModeActive,
      });

      const assistantMessage = {
        role: "assistant",
        content: aiResponse.reply,
        sources: Array.isArray(aiResponse.sources) ? aiResponse.sources : [],
        talkMode: this.talkModeActive,
      };

      // Add AI's response to the chat
      this.messages = [...this.messages, assistantMessage];

      // Show crisis resources if needed - check for both isCrisis flag and content filter responses
      const isContentFilterResponse =
        aiResponse.reply.includes("988") && aiResponse.reply.includes("741741");

      if (
        (aiResponse.isCrisis && aiResponse.resources) ||
        isContentFilterResponse
      ) {
        // Ensure we have resources even for content filter responses
        this.crisisResources = aiResponse.resources || [
          { name: "National Suicide Prevention Lifeline", contact: "988" },
          { name: "Crisis Text Line", contact: "Text HOME to 741741" },
          {
            name: "International Association for Suicide Prevention",
            url: "https://www.iasp.info/resources/Crisis_Centres/",
          },
        ];
        this.showCrisisResources = true;
      }

      // Handle audio playback for talk mode
      if (this.talkModeActive && aiResponse.audioData) {
        // Use GPT-4 Audio's native audio
        this._playAudioData(aiResponse.audioData);
      } else if (this.talkModeActive && aiResponse.reply) {
        // Fallback to TTS if no audio data
        this._speakResponse(aiResponse.reply);
      }
    } catch (error) {
      console.error("Error calling model:", error);

      let errorMessage = "I'm sorry, I'm having trouble responding right now. ";

      // Add more specific error information
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        errorMessage +=
          "I couldn't connect to the server. Please check your internet connection. ";
      } else if (error.message.includes("API returned")) {
        errorMessage +=
          "The server encountered an error processing your request. ";
      }

      errorMessage +=
        "If you're feeling in crisis, please call a crisis service like 988 (in the US) or your local emergency number.";

      this.messages = [
        ...this.messages,
        {
          role: "assistant",
          content: errorMessage,
        },
      ];
    } finally {
      this.isLoading = false;
    }
  }

  async _apiCall(message) {
    // Use audio endpoint when in talk mode, regular endpoint otherwise
    const endpoint = this.talkModeActive ? "/chat-audio" : "/chat";
    const apiUrl = API_URL + endpoint;

    console.log(`🌐 Calling API: ${apiUrl}`);

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        useRAG: this.ragEnabled,
        sessionId: this.sessionId,
        mode: this.talkModeActive ? "talk" : "chat",
        userInfo: this._hasUserInfo() ? this.userInfo : null,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ API Error: ${res.status} - ${errorText}`);
      throw new Error(`API returned ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data;
  }

  _initializeSpeech() {
    const hasSynthesis =
      typeof window !== "undefined" && "speechSynthesis" in window;
    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!hasSynthesis || !SpeechRecognition) {
      this.talkModeSupported = false;
      return;
    }

    this.talkModeSupported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = "en-US";
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.requestUpdate();
    };

    this.recognition.onspeechstart = () => {
      if (this.isSpeaking) {
        this._stopSpeaking();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.requestUpdate();
      if (this.talkModeActive && !this.isSpeaking) {
        setTimeout(() => this._startListening(), 300);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        return;
      }
      this.speechError = "Speech recognition error: " + event.error;
      this.talkModeActive = false;
      this._stopListening();
      this._stopSpeaking();
      this.requestUpdate();
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        this._handleSpeechInput(transcript);
      }
    };
  }

  _handleSpeechInput(transcript) {
    this._sendMessage(transcript, { fromSpeech: true });
  }

  _startListening() {
    if (!this.recognition || this.isListening) {
      return;
    }
    try {
      this.recognition.start();
    } catch (error) {
      // Ignore restarts while recognition is already running
    }
  }

  _stopListening() {
    if (!this.recognition) {
      return;
    }
    try {
      this.recognition.stop();
    } catch (error) {
      // Ignore stop errors when recognition is already inactive
    }
    this.isListening = false;
    this.requestUpdate();
  }

  _stopSpeaking() {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
      this.bargeInTimer = null;
    }

    // Stop native audio if playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    window.speechSynthesis.cancel();
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  _playAudioData(base64Audio) {
    if (!base64Audio) {
      return;
    }

    this._stopSpeaking();

    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Audio);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mp3" });
      const audioUrl = URL.createObjectURL(blob);

      // Create and play audio
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      audio.onplay = () => {
        this.isSpeaking = true;
        this._stopListening();
        this.requestUpdate();
      };

      const resumeListening = () => {
        this.isSpeaking = false;
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        this.requestUpdate();
        if (this.talkModeActive) {
          this._startListening();
        }
      };

      audio.onended = resumeListening;
      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        resumeListening();
      };

      audio.play().catch((err) => {
        console.error("Failed to play audio:", err);
        resumeListening();
      });
    } catch (error) {
      console.error("Error processing audio data:", error);
      this.isSpeaking = false;
      this.requestUpdate();
    }
  }

  _speakResponse(text) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    this._stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this._stopListening();
      this.requestUpdate();
      this._scheduleBargeInResume();
    };

    const resumeListening = () => {
      this.isSpeaking = false;
      this.requestUpdate();
      if (this.talkModeActive) {
        this._startListening();
      }
    };

    utterance.onend = resumeListening;
    utterance.onerror = resumeListening;

    window.speechSynthesis.speak(utterance);
  }

  _scheduleBargeInResume() {
    if (!this.talkModeActive) {
      return;
    }
    if (this.bargeInTimer) {
      clearTimeout(this.bargeInTimer);
    }
    this.bargeInTimer = setTimeout(() => {
      this.bargeInTimer = null;
      if (this.talkModeActive && this.isSpeaking) {
        this._startListening();
      }
    }, 600);
  }

  // Sidebar methods
  _toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  _switchTab(tab) {
    this.activeTab = tab;
  }

  _renderPersonalInfoTab() {
    return html`
      <p class="sidebar-description">
        Help Vish understand you better! This information is optional and will
        be used to personalize your experience.
      </p>

      <form class="user-info-form" @submit=${this._saveUserInfo}>
        <div class="form-group">
          <label for="userName">Name</label>
          <input
            type="text"
            id="userName"
            placeholder="Your name"
            .value=${this.userInfo.name || ""}
            @input=${(e) => this._updateUserInfo("name", e.target.value)}
          />
        </div>

        <div class="form-group">
          <label for="userAge">Age</label>
          <input
            type="number"
            id="userAge"
            placeholder="Your age"
            min="1"
            max="120"
            .value=${this.userInfo.age || ""}
            @input=${(e) => this._updateUserInfo("age", e.target.value)}
          />
        </div>

        <div class="form-group">
          <label for="gender">Gender</label>
          <select
            id="gender"
            .value=${this.userInfo.gender || ""}
            @change=${(e) => this._updateUserInfo("gender", e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label for="pronouns">Preferred Pronouns (Optional)</label>
          <input
            type="text"
            id="pronouns"
            placeholder="e.g., he/him, she/her, they/them"
            .value=${this.userInfo.pronouns || ""}
            @input=${(e) => this._updateUserInfo("pronouns", e.target.value)}
          />
        </div>

        <div class="form-group">
          <label>Occupation</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                name="occupationType"
                value="student"
                ?checked=${this.userInfo.occupationType === "student"}
                @change=${(e) =>
                  this._updateUserInfo("occupationType", e.target.value)}
              />
              <span>Student</span>
            </label>
            <label class="radio-label">
              <input
                type="radio"
                name="occupationType"
                value="working"
                ?checked=${this.userInfo.occupationType === "working"}
                @change=${(e) =>
                  this._updateUserInfo("occupationType", e.target.value)}
              />
              <span>Working</span>
            </label>
          </div>
        </div>

        ${this.userInfo.occupationType === "student"
          ? html`
              <div class="form-group">
                <label for="course">Course</label>
                <input
                  type="text"
                  id="course"
                  placeholder="e.g., BTech, BBA, MBA"
                  .value=${this.userInfo.course || ""}
                  @input=${(e) =>
                    this._updateUserInfo("course", e.target.value)}
                />
              </div>

              <div class="form-group">
                <label for="branch">Branch/Specialization</label>
                <input
                  type="text"
                  id="branch"
                  placeholder="e.g., CSE, ECE, Finance"
                  .value=${this.userInfo.branch || ""}
                  @input=${(e) =>
                    this._updateUserInfo("branch", e.target.value)}
                />
              </div>
            `
          : ""}
        ${this.userInfo.occupationType === "working"
          ? html`
              <div class="form-group">
                <label for="jobTitle">Job Title</label>
                <input
                  type="text"
                  id="jobTitle"
                  placeholder="Your job title"
                  .value=${this.userInfo.jobTitle || ""}
                  @input=${(e) =>
                    this._updateUserInfo("jobTitle", e.target.value)}
                />
              </div>

              <div class="form-group">
                <label for="organization">Organization</label>
                <input
                  type="text"
                  id="organization"
                  placeholder="Your company/organization"
                  .value=${this.userInfo.organization || ""}
                  @input=${(e) =>
                    this._updateUserInfo("organization", e.target.value)}
                />
              </div>
            `
          : ""}

        <div class="form-group">
          <label for="currentMood">Current Mood/Emotional State</label>
          <select
            id="currentMood"
            .value=${this.userInfo.currentMood || ""}
            @change=${(e) =>
              this._updateUserInfo("currentMood", e.target.value)}
          >
            <option value="">Select if you'd like...</option>
            <option value="great">Great - Feeling positive</option>
            <option value="good">Good - Doing well</option>
            <option value="okay">Okay - Getting by</option>
            <option value="struggling">
              Struggling - Finding things difficult
            </option>
            <option value="difficult">
              Very Difficult - Need extra support
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="concerns">Primary Concerns or Goals (Optional)</label>
          <textarea
            id="concerns"
            placeholder="What brings you here? What would you like help with? (e.g., anxiety, stress management, work-life balance, relationships)"
            rows="3"
            .value=${this.userInfo.concerns || ""}
            @input=${(e) => this._updateUserInfo("concerns", e.target.value)}
          ></textarea>
        </div>

        <div class="form-group">
          <label for="communicationStyle">Preferred Communication Style</label>
          <select
            id="communicationStyle"
            .value=${this.userInfo.communicationStyle || ""}
            @change=${(e) =>
              this._updateUserInfo("communicationStyle", e.target.value)}
          >
            <option value="">No preference</option>
            <option value="direct">Direct - Get straight to the point</option>
            <option value="gentle">Gentle - Soft and encouraging</option>
            <option value="analytical">
              Analytical - Logical and structured
            </option>
            <option value="empathetic">
              Empathetic - Understanding and emotional
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="previousTherapy"
            >Previous Therapy/Counseling Experience</label
          >
          <select
            id="previousTherapy"
            .value=${this.userInfo.previousTherapy || ""}
            @change=${(e) =>
              this._updateUserInfo("previousTherapy", e.target.value)}
          >
            <option value="">Prefer not to say</option>
            <option value="yes-current">Yes - Currently in therapy</option>
            <option value="yes-past">Yes - Previously had therapy</option>
            <option value="no">No - First time seeking support</option>
          </select>
        </div>

        <div class="form-group">
          <label for="preferredRole"
            >How would you like Vish to interact with you?</label
          >
          <select
            id="preferredRole"
            .value=${this.userInfo.preferredRole || ""}
            @change=${(e) =>
              this._updateUserInfo("preferredRole", e.target.value)}
          >
            <option value="">No preference</option>
            <option value="friend">Friend - Casual and supportive</option>
            <option value="therapist">
              Therapist - Professional and structured
            </option>
            <option value="mentor">Mentor - Guiding and advisory</option>
            <option value="sibling">Sibling - Familiar and caring</option>
            <option value="family">Family Member - Warm and protective</option>
            <option value="partner">
              Partner/Significant Other - Intimate and understanding
            </option>
            <option value="coach">
              Life Coach - Motivational and goal-oriented
            </option>
            <option value="confidant">
              Confidant - Trustworthy and non-judgmental
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="aboutMe">About Me</label>
          <textarea
            id="aboutMe"
            placeholder="Share anything you'd like Vish to know about you..."
            rows="4"
            .value=${this.userInfo.aboutMe || ""}
            @input=${(e) => this._updateUserInfo("aboutMe", e.target.value)}
          ></textarea>
        </div>

        <button type="submit" class="save-info-btn">Save Information</button>
        ${this._hasUserInfo()
          ? html`
              <button
                type="button"
                class="clear-info-btn"
                @click=${this._clearUserInfo}
              >
                Clear Information
              </button>
            `
          : ""}
      </form>
    `;
  }

  _renderDocumentsTab() {
    return html`
      <p class="sidebar-description">
        Upload your own documents for Vish to reference. This helps provide more
        personalized and contextual support.
      </p>

      <div class="document-upload-section">
        <input
          type="file"
          id="file-upload-input"
          accept=".pdf,.txt,.doc,.docx"
          @change=${this._handleFileUpload}
          style="display: none;"
          ?disabled=${this.isUploadingDoc}
        />
        <label for="file-upload-input" class="upload-label">
          <span class="upload-btn" ?disabled=${this.isUploadingDoc}>
            ${this.isUploadingDoc ? "⏳ Uploading..." : "📤 Upload Document"}
          </span>
        </label>
        <p class="upload-hint">Supported: PDF, TXT, DOC, DOCX (Max 10MB)</p>
      </div>

      <div class="documents-list">
        <h4>Your Documents (${this.userDocuments.length})</h4>
        ${this.userDocuments.length === 0
          ? html`
              <p class="no-documents">
                No documents uploaded yet. Add your first document to get
                started!
              </p>
            `
          : html`
              <ul class="doc-items">
                ${this.userDocuments.map(
                  (doc, index) => html`
                    <li class="doc-item">
                      <div class="doc-info">
                        <span class="doc-icon">📄</span>
                        <div class="doc-details">
                          <span class="doc-name">${doc.name}</span>
                          <span class="doc-size"
                            >${this._formatFileSize(doc.size)} •
                            ${this._formatDate(doc.uploadedAt)}</span
                          >
                        </div>
                      </div>
                      <button
                        class="doc-delete-btn"
                        @click=${() => this._deleteDocument(index)}
                        title="Remove document"
                      >
                        🗑️
                      </button>
                    </li>
                  `
                )}
              </ul>
            `}
      </div>
    `;
  }

  _loadUserInfo() {
    try {
      const savedInfo = localStorage.getItem("vishUserInfo");
      return savedInfo ? JSON.parse(savedInfo) : {};
    } catch (error) {
      console.error("Error loading user info:", error);
      return {};
    }
  }

  _updateUserInfo(field, value) {
    this.userInfo = {
      ...this.userInfo,
      [field]: value,
    };
  }

  _saveUserInfo(e) {
    e.preventDefault();
    try {
      localStorage.setItem("vishUserInfo", JSON.stringify(this.userInfo));

      // Show success feedback
      const saveBtn = e.target.querySelector(".save-info-btn");
      const originalText = saveBtn.textContent;
      saveBtn.textContent = "✓ Saved!";
      saveBtn.style.backgroundColor = "#6abf9f";

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.backgroundColor = "";
      }, 2000);

      this.requestUpdate();
    } catch (error) {
      console.error("Error saving user info:", error);
      alert("Failed to save information. Please try again.");
    }
  }

  _clearUserInfo(e) {
    e.preventDefault();
    if (
      confirm("Are you sure you want to clear all your personal information?")
    ) {
      this.userInfo = {};
      localStorage.removeItem("vishUserInfo");
      this.requestUpdate();
    }
  }

  _hasUserInfo() {
    return Object.keys(this.userInfo).some(
      (key) => this.userInfo[key] && this.userInfo[key].toString().trim()
    );
  }

  // Document management methods
  _loadUserDocuments() {
    try {
      const savedDocs = localStorage.getItem("vishUserDocuments");
      return savedDocs ? JSON.parse(savedDocs) : [];
    } catch (error) {
      console.error("Error loading user documents:", error);
      return [];
    }
  }

  _saveUserDocuments() {
    try {
      localStorage.setItem(
        "vishUserDocuments",
        JSON.stringify(this.userDocuments)
      );
    } catch (error) {
      console.error("Error saving user documents:", error);
    }
  }

  async _handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      e.target.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = [".pdf", ".txt", ".doc", ".docx"];
    const fileExt = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      alert("Please upload a PDF, TXT, DOC, or DOCX file");
      e.target.value = "";
      return;
    }

    this.isUploadingDoc = true;

    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await fetch(API_URL + "/upload-document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      // Add document to list
      this.userDocuments = [
        ...this.userDocuments,
        {
          id: result.id || Date.now().toString(),
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          path: result.path || file.name,
        },
      ];

      this._saveUserDocuments();
      alert(`✓ ${file.name} uploaded successfully!`);
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("Failed to upload document. Please try again.");
    } finally {
      this.isUploadingDoc = false;
      e.target.value = ""; // Reset file input
    }
  }

  async _deleteDocument(index) {
    if (
      !confirm(
        `Are you sure you want to remove "${this.userDocuments[index].name}"?`
      )
    ) {
      return;
    }

    const doc = this.userDocuments[index];

    try {
      // Call backend to delete the document
      await fetch(API_URL + `/delete-document/${doc.id}`, {
        method: "DELETE",
      });

      // Remove from list
      this.userDocuments = this.userDocuments.filter((_, i) => i !== index);
      this._saveUserDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document. It has been removed from your list.");
      // Still remove from list even if backend delete fails
      this.userDocuments = this.userDocuments.filter((_, i) => i !== index);
      this._saveUserDocuments();
    }
  }

  _formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  _formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  // Chat session management methods
  _loadChatSessions() {
    try {
      const savedSessions = localStorage.getItem("vishChatSessions");
      return savedSessions ? JSON.parse(savedSessions) : [];
    } catch (error) {
      console.error("Error loading chat sessions:", error);
      return [];
    }
  }

  _saveChatSessions() {
    try {
      localStorage.setItem(
        "vishChatSessions",
        JSON.stringify(this.chatSessions)
      );
    } catch (error) {
      console.error("Error saving chat sessions:", error);
    }
  }

  _getCurrentChatId() {
    const currentId = localStorage.getItem("vishCurrentChatId");
    if (currentId) return currentId;

    // Create a new chat ID
    const newId =
      "chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("vishCurrentChatId", newId);
    return newId;
  }

  _saveCurrentChat() {
    if (this.messages.length === 0) return;

    // Find existing session or create new one
    const existingIndex = this.chatSessions.findIndex(
      (s) => s.id === this.currentChatId
    );

    // Preserve custom title if it exists and is not "New Chat", otherwise generate new one
    const existingTitle =
      existingIndex >= 0 ? this.chatSessions[existingIndex].title : null;
    const shouldGenerateNewTitle =
      !existingTitle || existingTitle === "New Chat";
    const title = shouldGenerateNewTitle
      ? this._generateChatTitle()
      : existingTitle;

    const chatSession = {
      id: this.currentChatId,
      title: title,
      messages: this.messages,
      sessionId: this.sessionId,
      createdAt:
        existingIndex >= 0
          ? this.chatSessions[existingIndex].createdAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.chatSessions[existingIndex] = chatSession;
    } else {
      this.chatSessions = [chatSession, ...this.chatSessions];
    }

    this._saveChatSessions();
  }

  _generateChatTitle() {
    // Get first user message as title
    const firstUserMsg = this.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      const title = firstUserMsg.content.substring(0, 30);
      return title.length < firstUserMsg.content.length ? title + "..." : title;
    }
    return "New Chat";
  }

  _startNewChat(skipSave = false) {
    // Save current chat before starting new one (unless skipSave is true)
    if (!skipSave) {
      this._saveCurrentChat();
    }

    // Clear current messages
    this.messages = [];
    clearMessages();

    // Generate new IDs
    this.currentChatId =
      "chat_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    this.sessionId = this._generateSessionId();
    localStorage.setItem("vishCurrentChatId", this.currentChatId);

    // Add welcome message
    this._addWelcomeMessage();

    this.requestUpdate();
  }

  _toggleHistorySidebar() {
    this.historySidebarOpen = !this.historySidebarOpen;
  }

  _loadChatSession(chatId) {
    const session = this.chatSessions.find((s) => s.id === chatId);
    if (!session) return;

    // Save current chat first
    if (this.messages.length > 0) {
      this._saveCurrentChat();
    }

    // Load selected chat
    this.currentChatId = session.id;
    this.sessionId = session.sessionId;
    this.messages = session.messages;
    localStorage.setItem("vishCurrentChatId", chatId);
    saveMessages(this.messages);

    // Close history sidebar
    this.historySidebarOpen = false;

    this.requestUpdate();
  }

  _deleteChat(chatId, event) {
    event.stopPropagation();

    const session = this.chatSessions.find((s) => s.id === chatId);
    if (!session) return;

    if (!confirm(`Delete chat: "${session.title}"?`)) return;

    // Check if deleting current chat
    const isDeletingCurrentChat = chatId === this.currentChatId;

    // Remove from sessions
    this.chatSessions = this.chatSessions.filter((s) => s.id !== chatId);
    this._saveChatSessions();

    // If deleted current chat, start new one without saving
    if (isDeletingCurrentChat) {
      this._startNewChat(true); // Skip saving the deleted chat
    }

    this.requestUpdate();
  }

  _deleteAllChats() {
    if (!confirm("Delete all chat history? This cannot be undone.")) return;

    // Clear all sessions
    this.chatSessions = [];
    this._saveChatSessions();

    // Start new chat without saving current one
    this._startNewChat(true);
    this.requestUpdate();
  }

  _renameChat(chatId, event) {
    event.stopPropagation();

    const session = this.chatSessions.find((s) => s.id === chatId);
    if (!session) return;

    const newTitle = prompt("Enter new chat name:", session.title);
    if (!newTitle || newTitle.trim() === "") return;

    // Update the title
    session.title = newTitle.trim();
    this._saveChatSessions();

    // If this is the current chat, also update it in the sessions array
    if (chatId === this.currentChatId) {
      this._saveCurrentChat();
    }

    this.requestUpdate();
  }

  _formatDateTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // If today, show time
    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    // If this week, show day and time
    if (diffDays < 7) {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    // Otherwise show full date and time
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  _getUserInfoContext() {
    if (!this._hasUserInfo()) {
      return "";
    }

    let context = "\n\n[User Information for Context]:\n";

    if (this.userInfo.name) {
      context += `- Name: ${this.userInfo.name}\n`;
    }
    if (this.userInfo.age) {
      context += `- Age: ${this.userInfo.age}\n`;
    }
    if (this.userInfo.gender) {
      context += `- Gender: ${this.userInfo.gender}\n`;
    }
    if (this.userInfo.pronouns) {
      context += `- Preferred Pronouns: ${this.userInfo.pronouns}\n`;
    }
    if (this.userInfo.occupationType === "student") {
      context += "- Occupation: Student\n";
      if (this.userInfo.course) {
        context += `- Course: ${this.userInfo.course}\n`;
      }
      if (this.userInfo.branch) {
        context += `- Branch/Specialization: ${this.userInfo.branch}\n`;
      }
    } else if (this.userInfo.occupationType === "working") {
      context += "- Occupation: Working Professional\n";
      if (this.userInfo.jobTitle) {
        context += `- Job Title: ${this.userInfo.jobTitle}\n`;
      }
      if (this.userInfo.organization) {
        context += `- Organization: ${this.userInfo.organization}\n`;
      }
    }
    if (this.userInfo.currentMood) {
      context += `- Current Emotional State: ${this.userInfo.currentMood}\n`;
    }
    if (this.userInfo.concerns) {
      context += `- Primary Concerns/Goals: ${this.userInfo.concerns}\n`;
    }
    if (this.userInfo.communicationStyle) {
      context += `- Preferred Communication Style: ${this.userInfo.communicationStyle}\n`;
    }
    if (this.userInfo.previousTherapy) {
      context += `- Therapy Experience: ${this.userInfo.previousTherapy}\n`;
    }
    if (this.userInfo.preferredRole) {
      context += `- Preferred Interaction Style: ${this.userInfo.preferredRole}\n`;
    }
    if (this.userInfo.aboutMe) {
      context += `- About: ${this.userInfo.aboutMe}\n`;
    }

    context +=
      "\nPlease use this information naturally and adapt your responses to their preferences. Be especially mindful of their emotional state and communication style. Use their preferred pronouns consistently.";

    if (this.userInfo.preferredRole) {
      const roleInstructions = {
        friend:
          "Interact as a supportive friend would - casual, warm, and understanding.",
        therapist:
          "Maintain a professional therapeutic approach with structure and clinical insights.",
        mentor:
          "Provide guidance and wisdom like a trusted mentor, helping them grow and learn.",
        sibling:
          "Be familiar and caring like a sibling - protective yet relatable.",
        family:
          "Act as a warm family member would - protective, loving, and unconditionally supportive.",
        partner:
          "Interact with intimate understanding like a caring partner - emotionally attuned and deeply supportive.",
        coach:
          "Be motivational and goal-oriented like a life coach - energetic and action-focused.",
        confidant:
          "Be a trustworthy confidant - non-judgmental, discreet, and deeply understanding.",
      };

      if (roleInstructions[this.userInfo.preferredRole]) {
        context += ` ${roleInstructions[this.userInfo.preferredRole]}`;
      }
    }

    context += "\n";

    return context;
  }
}

customElements.define("chat-interface", ChatInterface);
