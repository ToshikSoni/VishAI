import { LitElement, html } from 'lit';
import { loadMessages, saveMessages, clearMessages } from '../utils/chatStore.js';
import './chat.css';

export class ChatInterface extends LitElement {
  static get properties() {
    return {
      messages: { type: Array },
      inputMessage: { type: String },
      isLoading: { type: Boolean },
      isRetrieving: { type: Boolean },
      ragEnabled: { type: Boolean },
      showCrisisResources: { type: Boolean },
      crisisResources: { type: Array }
    };
  }

  constructor() {
    super();
    this.messages = [];
    this.inputMessage = '';
    this.isLoading = false;
    this.isRetrieving = false;
    this.ragEnabled = true; // Enable RAG by default
    this.showCrisisResources = false;
    this.crisisResources = [];
    this.sessionId = this._generateSessionId();
  }

  // Create a unique session ID for this conversation
  _generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
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
  }

  _addGoogleFont() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
  }

  _addWelcomeMessage() {
    const welcomeMessage = {
      role: 'assistant',
      content: "Hello there! I'm Vish, your friendly AI companion. I'm here to support you and provide a safe space for us to chat about whatever is on your mind. How are you feeling today? Remember, it's okay to not be okay, and I'm here to listen.",
      isWelcome: true
    };
    this.messages = [welcomeMessage];
    saveMessages(this.messages);
  }

  updated(changedProps) {
    // Save chat history to localStorage whenever messages change
    if (changedProps.has('messages')) {
      saveMessages(this.messages);

      // Scroll to the bottom of the chat
      const chatMessages = this.querySelector('.chat-messages');
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }

  render() {
    return html`
    <div class="chat-container">
      <div class="chat-header">
        <h2 class="chat-title">Vish AI Friend</h2>
        <div class="header-controls">
          <label class="rag-toggle">
            <input type="checkbox" ?checked=${this.ragEnabled} @change=${this._toggleRag}>
            Use Supportive Resources
          </label>
          <button class="clear-chat-btn" @click=${this._clearChat}>Start Fresh Chat</button>
        </div>
      </div>

      <div class="chat-messages">
        ${this.showCrisisResources ? html`
          <div class="crisis-resources">
            <h3>Help is Always Available</h3>
            <ul>
              ${this.crisisResources.map(resource => html`
                <li>
                  <strong>${resource.name}:</strong> 
                  ${resource.contact ? html`<span class="resource-contact">${resource.contact}</span>` : ''}
                  ${resource.url ? html`<a href="${resource.url}" target="_blank" rel="noopener noreferrer">${resource.url}</a>` : ''}
                </li>
              `)}
            </ul>
            <p class="crisis-note">If you're feeling unsafe, please call emergency services (911 in the US) or reach out to someone you trust.</p>
          </div>
        ` : ''}
        
        ${this.messages.map(message => html`
          <div class="message ${message.role === 'user' ? 'user-message' : 'ai-message'} ${message.isWelcome ? 'welcome-message' : ''}">
            <div class="message-content">
              <span class="message-sender">${message.role === 'user' ? '👤 You' : '💚 Vish'}</span>
              <p>${message.content}</p>
              ${this.ragEnabled && message.sources && message.sources.length > 0 ? html`
                <details class="sources">
                  <summary>📚 Resources I'm Drawing From</summary>
                  <div class="sources-content">
                    ${message.sources.map(source => html`<p>${source}</p>`)}
                  </div>
                </details>
              ` : ''}
            </div>
          </div>
        `)}
        
        ${this.isRetrieving ? html`
          <div class="message system-message">
            <p>📚 Finding helpful resources for you...</p>
          </div>
        ` : ''}
        
        ${this.isLoading && !this.isRetrieving ? html`
          <div class="message ai-message thinking">
            <div class="message-content">
              <span class="message-sender">Vish</span>
              <p><span class="typing-indicator">Thinking<span>.</span><span>.</span><span>.</span></span></p>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="chat-input">
        <input 
            type="text" 
            placeholder="Share your thoughts..."
            .value=${this.inputMessage}
            @input=${this._handleInput}
            @keyup=${this._handleKeyUp}
        />
        <button class="send-button" @click=${this._sendMessage} ?disabled=${this.isLoading || !this.inputMessage.trim()}>
          Send
        </button>
      </div>
      
      <div class="chat-footer">
        <p class="disclaimer">This is an AI LLM not a professional therapist. Kindly consult a professional for serious issues.</p>
      </div>
    </div>
  `;
  }

  _toggleRag(e) {
    this.ragEnabled = e.target.checked;
  }

  // Clear chat history and start fresh
  _clearChat() {
    clearMessages();
    this.messages = [];
    this._addWelcomeMessage();
    this.showCrisisResources = false;

    // Clear the server-side memory as well
    fetch("https://vishapii.azurewebsites.net/clear-memory", {
      // fetch("http://localhost:3001/clear-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.sessionId }),
    }).catch(error => {
      console.error('Failed to clear server memory:', error);
    });
  }

  // Update inputMessage state as the user types
  _handleInput(e) {
    this.inputMessage = e.target.value;
  }

  // Send message on Enter key if not loading
  _handleKeyUp(e) {
    if (e.key === 'Enter' && this.inputMessage.trim() && !this.isLoading) {
      this._sendMessage();
    }
  }

  // Handle sending a message and receiving a response
  async _sendMessage() {
    if (!this.inputMessage.trim() || this.isLoading) return;

    // Add user's message to the chat
    const userMessage = {
      role: 'user',
      content: this.inputMessage
    };

    this.messages = [...this.messages, userMessage];
    const userQuery = this.inputMessage;
    this.inputMessage = '';
    this.isLoading = true;

    try {
      // Call API for response
      const aiResponse = await this._apiCall(userQuery);

      // Add AI's response to the chat
      this.messages = [
        ...this.messages,
        {
          role: 'assistant',
          content: aiResponse.reply,
          sources: aiResponse.sources
        }
      ];

      // Show crisis resources if needed
      if (aiResponse.isCrisis && aiResponse.resources) {
        this.crisisResources = aiResponse.resources;
        this.showCrisisResources = true;
      }
    } catch (error) {
      console.error('Error calling model:', error);
      this.messages = [
        ...this.messages,
        {
          role: 'assistant',
          content: "I'm sorry, I'm having trouble responding right now. If you're feeling in crisis, please call a crisis service like 988 (in the US) or your local emergency number."
        }
      ];
    } finally {
      this.isLoading = false;
    }
  }

  async _apiCall(message) {
    // Use window.location.hostname to make it work both locally and on other devices
    // const apiUrl = 'http://localhost:3001/chat';
    const apiUrl = 'https://vishapii.azurewebsites.net/chat';

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        useRAG: this.ragEnabled,
        sessionId: this.sessionId
      }),
    });
    const data = await res.json();
    return data;
  }
}

customElements.define('chat-interface', ChatInterface);