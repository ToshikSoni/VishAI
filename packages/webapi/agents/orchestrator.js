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
   * Check if agent handoff is recommended based on conversation context
   * @param {string} message - Current user message
   * @param {string} currentAgentRole - Currently active agent
   * @returns {object} Handoff recommendation
   */
  shouldHandoffAgent(message, currentAgentRole) {
    const messageLower = message.toLowerCase();

    // Crisis agent should never hand off (user safety priority)
    if (currentAgentRole === 'crisis-counselor') {
      return { shouldHandoff: false };
    }

    // Check if user needs crisis support while with another agent
    const hasCrisisKeyword = agents.crisis.triggerKeywords.some(keyword => 
      messageLower.includes(keyword)
    );
    if (hasCrisisKeyword && currentAgentRole !== 'crisis-counselor') {
      return {
        shouldHandoff: true,
        targetAgent: 'crisis-counselor',
        reason: 'crisis-detected',
        handoffMessage: "I'm noticing you're expressing thoughts that concern me deeply. Let me connect you with our crisis counselor who specializes in immediate support."
      };
    }

    // Check if user explicitly requests different type of help
    if (messageLower.includes('breathing') || messageLower.includes('calm down') || messageLower.includes('grounding')) {
      if (currentAgentRole !== 'mindfulness-coach') {
        return {
          shouldHandoff: true,
          targetAgent: 'mindfulness-coach', 
          reason: 'mindfulness-requested',
          handoffMessage: "I can help with that, or I can connect you with our mindfulness coach who specializes in calming techniques and breathing exercises. Would you like that?"
        };
      }
    }

    if (messageLower.includes('negative thoughts') || messageLower.includes('cognitive') || messageLower.includes('thinking patterns')) {
      if (currentAgentRole !== 'cbt-therapist') {
        return {
          shouldHandoff: true,
          targetAgent: 'cbt-therapist',
          reason: 'cbt-requested',
          handoffMessage: "Those thought patterns sound like something our CBT therapist could help you work through more effectively. Would you like me to connect you?"
        };
      }
    }

    return { shouldHandoff: false };
  }

  /**
   * Generate smooth handoff message when switching agents
   * @param {string} fromAgent - Previous agent role
   * @param {string} toAgent - New agent role
   * @returns {string} Handoff introduction message
   */
  generateHandoffMessage(fromAgent, toAgent) {
    const handoffMessages = {
      'companion-crisis': "I'm connecting you with our crisis counselor right now. They're specially trained for these situations and are here to help.",
      'companion-cbt': "Let me introduce you to our CBT therapist who can help you work through these thought patterns.",
      'companion-mindfulness': "Our mindfulness coach can guide you through some calming techniques. They're excellent at this.",
      'cbt-crisis': "I'm noticing this might need immediate crisis support. Let me connect you with our crisis counselor right away.",
      'cbt-mindfulness': "For immediate relief, our mindfulness coach can guide you through grounding exercises.",
      'mindfulness-crisis': "I'm connecting you with our crisis counselor who can provide the urgent support you need.",
      'mindfulness-cbt': "For deeper work on those thought patterns, our CBT therapist would be perfect."
    };

    const key = `${fromAgent}-${toAgent}`;
    return handoffMessages[key] || `I'm connecting you with a specialist who can help better with your specific needs.`;
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
   * Get handoff context for agent system prompts
   */
  getHandoffContext() {
    if (this.conversationContext.agentHistory.length <= 1) {
      return '';
    }

    const previousAgent = this.conversationContext.agentHistory[this.conversationContext.agentHistory.length - 2];
    if (!previousAgent || previousAgent.agent === this.activeAgent?.role) {
      return '';
    }

    return `\n\n[HANDOFF NOTE: User was previously speaking with ${previousAgent.agent} agent. Acknowledge the transition smoothly and build on any previous conversation context.]`;
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
