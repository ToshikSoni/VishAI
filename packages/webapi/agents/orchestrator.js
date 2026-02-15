/**
 * Agent Orchestrator
 * Routes user messages to the appropriate specialized agent
 * Implements multi-agent coordination for VishAI
 */

import { agents } from './agent-definitions.js';

export class AgentOrchestrator {
  constructor(mcpClient = null) {
    this.mcpClient = mcpClient;
    this.activeAgent = null;
    this.conversationContext = {
      agentHistory: [], // Track which agents have been used
      crisisLevel: 'low',
      lastAgentSwitch: null
    };
  }

  /**
   * Select the most appropriate agent for the user's message
   * @param {string} message - User's message
   * @param {string} sessionId - Session identifier
   * @returns {object} Selected agent configuration
   */
  async selectAgent(message, sessionId) {
    const messageLower = message.toLowerCase();

    // 1. FIRST PRIORITY: Check for crisis using MCP tool if available
    if (this.mcpClient) {
      try {
        const crisisAssessment = await this.mcpClient.callTool('assess_crisis_level', { message });
        this.conversationContext.crisisLevel = crisisAssessment.result.crisisLevel;
        
        if (crisisAssessment.result.shouldEscalateToCrisisAgent) {
          console.log(`🚨 Crisis detected (${crisisAssessment.result.crisisLevel}) - Routing to Crisis Agent`);
          this.activeAgent = agents.crisis;
          this.recordAgentSelection('crisis', 'crisis-detected');
          return this.activeAgent;
        }
      } catch (error) {
        console.warn('MCP crisis assessment failed, using fallback:', error.message);
      }
    }

    // Fallback crisis detection without MCP
    const hasCrisisKeyword = agents.crisis.triggerKeywords.some(keyword => 
      messageLower.includes(keyword)
    );
    
    if (hasCrisisKeyword) {
      console.log('🚨 Crisis keywords detected - Routing to Crisis Agent');
      this.activeAgent = agents.crisis;
      this.recordAgentSelection('crisis', 'keyword-match');
      return this.activeAgent;
    }

    // 2. Check for CBT-related requests
    const hasCBTKeyword = agents.cbt.triggerKeywords.some(keyword =>
      messageLower.includes(keyword)
    );
    
    if (hasCBTKeyword) {
      console.log('🧠 CBT request detected - Routing to CBT Therapist Agent');
      this.activeAgent = agents.cbt;
      this.recordAgentSelection('cbt', 'keyword-match');
      return this.activeAgent;
    }

    // 3. Check for mindfulness/breathing/grounding requests
    const hasMindfulnessKeyword = agents.mindfulness.triggerKeywords.some(keyword =>
      messageLower.includes(keyword)
    );
    
    if (hasMindfulnessKeyword) {
      console.log('🧘 Mindfulness/calming request detected - Routing to Mindfulness Coach Agent');
      this.activeAgent = agents.mindfulness;
      this.recordAgentSelection('mindfulness', 'keyword-match');
      return this.activeAgent;
    }

    // 4. DEFAULT: Use Companion Agent for general support
    console.log('💬 General conversation - Routing to Companion Agent');
    this.activeAgent = agents.companion;
    this.recordAgentSelection('companion', 'default');
    return this.activeAgent;
  }

  /**
   * Get the system prompt for the selected agent, with MCP context if available
   * @param {object} agent - Selected agent
   * @param {object} userProfile - User profile data
   * @returns {string} Enhanced system prompt
   */
  async getAgentSystemPrompt(agent, userProfile) {
    let systemPrompt = agent.systemPrompt;

    // Add user personalization context
    if (userProfile) {
      systemPrompt += `\n\n=== USER CONTEXT ===\n`;
      if (userProfile.name) systemPrompt += `Name: ${userProfile.name}\n`;
      if (userProfile.age) systemPrompt += `Age: ${userProfile.age}\n`;
      if (userProfile.occupation) systemPrompt += `Occupation: ${userProfile.occupation}\n`;
      if (userProfile.currentMood) systemPrompt += `Current Mood: ${userProfile.currentMood}\n`;
      if (userProfile.primaryConcerns) systemPrompt += `Primary Concerns: ${userProfile.primaryConcerns}\n`;
      if (userProfile.communicationStyle) systemPrompt += `Preferred Communication Style: ${userProfile.communicationStyle}\n`;
      if (userProfile.preferredRole) systemPrompt += `Preferred Interaction Role: ${userProfile.preferredRole}\n`;
    }

    // Add agent coordination context
    systemPrompt += `\n\n=== MULTI-AGENT SYSTEM CONTEXT ===\n`;
    systemPrompt += `You are part of a multi-agent system. You are: ${agent.name} (${agent.role})\n`;
    systemPrompt += `Other available agents:\n`;
    for (const [key, otherAgent] of Object.entries(agents)) {
      if (key !== agent.role) {
        systemPrompt += `- ${otherAgent.name}: ${otherAgent.expertise.join(', ')}\n`;
      }
    }
    systemPrompt += `\nIf the user's needs shift to another agent's expertise, acknowledge this naturally in your response. The system will route appropriately.\n`;

    return systemPrompt;
  }

  /**
   * Get MCP resources relevant to the current agent and query
   * @param {object} agent - Current agent
   * @param {string} userMessage - User's message
   * @returns {string} MCP resource context
   */
  async getMCPContext(agent, userMessage) {
    if (!this.mcpClient) return '';

    let context = '\n\n=== AVAILABLE KNOWLEDGE (via MCP) ===\n';

    try {
      // Crisis agent: Get crisis resources
      if (agent.role === 'crisis-counselor') {
        const crisisRes = await this.mcpClient.callTool('get_crisis_resources', { 
          country: 'US' 
        });
        context += `\nCRISIS RESOURCES:\n${JSON.stringify(crisisRes.result, null, 2)}\n`;
      }

      // CBT agent: Get relevant CBT techniques
      if (agent.role === 'cbt-therapist') {
        // Check if user is asking about specific technique
        const techniques = ['thought-challenging', 'behavioral-activation', 'problem-solving', 'exposure-therapy'];
        for (const technique of techniques) {
          if (userMessage.toLowerCase().includes(technique.replace('-', ' '))) {
            const techData = await this.mcpClient.callTool('get_cbt_technique', { technique });
            context += `\nCBT TECHNIQUE - ${technique}:\n${JSON.stringify(techData.result, null, 2)}\n`;
            break;
          }
        }
      }

      // Mindfulness agent: Get coping strategies
      if (agent.role === 'mindfulness-coach') {
        const strategies = await this.mcpClient.callTool('recommend_coping_strategies', {
          condition: 'anxiety',
          urgency: 'immediate',
          limit: 3
        });
        context += `\nRECOMMENDED COPING STRATEGIES:\n${JSON.stringify(strategies.result, null, 2)}\n`;
      }

      // All agents: Search for relevant mental health topics
      if (userMessage.length > 10) {
        const searchResults = await this.mcpClient.callTool('search_mental_health_topics', {
          query: userMessage,
          limit: 2
        });
        if (searchResults.result.resultsCount > 0) {
          context += `\nRELEVANT MENTAL HEALTH INFORMATION:\n${JSON.stringify(searchResults.result, null, 2)}\n`;
        }
      }

    } catch (error) {
      console.warn('Failed to fetch MCP context:', error.message);
      context += '\n(Note: Some knowledge resources temporarily unavailable)\n';
    }

    return context;
  }

  /**
   * Record agent selection for analytics
   */
  recordAgentSelection(agentRole, reason) {
    this.conversationContext.agentHistory.push({
      agent: agentRole,
      reason,
      timestamp: new Date().toISOString()
    });
    this.conversationContext.lastAgentSwitch = new Date().toISOString();
  }

  /**
   * Get the emotion for avatar based on current agent
   */
  getAgentEmotion() {
    return this.activeAgent?.emotion || 'empathy';
  }

  /**
   * Get agent metadata for response
   */
  getAgentMetadata() {
    return {
      agentName: this.activeAgent?.name || 'Companion',
      agentRole: this.activeAgent?.role || 'companion',
      agentEmotion: this.getAgentEmotion(),
      expertise: this.activeAgent?.expertise || [],
      agentHistory: this.conversationContext.agentHistory
    };
  }

  /**
   * Reset orchestrator state (e.g., for new session)
   */
  reset() {
    this.activeAgent = null;
    this.conversationContext = {
      agentHistory: [],
      crisisLevel: 'low',
      lastAgentSwitch: null
    };
  }
}

export default AgentOrchestrator;
