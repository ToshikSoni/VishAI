import { agents } from "./agent-definitions.js";

export class AgentOrchestrator {
  constructor(mcpClient = null) {
    this.mcpClient = mcpClient;
    this.activeAgent = null;
    this.conversationContext = {
      agentHistory: [],
      crisisLevel: "low",
      lastAgentSwitch: null,
    };
  }

  async selectAgent(message, sessionId) {
    const messageLower = message.toLowerCase();

    if (this.mcpClient) {
      try {
        const crisisAssessment = await this.mcpClient.callTool("assess_crisis_level", { message });
        this.conversationContext.crisisLevel = crisisAssessment.result.crisisLevel;
        if (crisisAssessment.result.shouldEscalateToCrisisAgent) {
          this.activeAgent = agents.crisis;
          this._recordAgentSelection("crisis", "crisis-detected");
          return this.activeAgent;
        }
      } catch (error) {
        console.warn("MCP crisis assessment failed, using fallback:", error.message);
      }
    }

    const hasCrisisKeyword = agents.crisis.triggerKeywords.some((kw) => messageLower.includes(kw));
    if (hasCrisisKeyword) {
      this.activeAgent = agents.crisis;
      this._recordAgentSelection("crisis", "keyword-match");
      return this.activeAgent;
    }

    if (agents.cbt.triggerKeywords.some((kw) => messageLower.includes(kw))) {
      this.activeAgent = agents.cbt;
      this._recordAgentSelection("cbt", "keyword-match");
      return this.activeAgent;
    }

    if (agents.mindfulness.triggerKeywords.some((kw) => messageLower.includes(kw))) {
      this.activeAgent = agents.mindfulness;
      this._recordAgentSelection("mindfulness", "keyword-match");
      return this.activeAgent;
    }

    this.activeAgent = agents.companion;
    this._recordAgentSelection("companion", "default");
    return this.activeAgent;
  }

  async getAgentSystemPrompt(agent, userProfile) {
    let systemPrompt = agent.systemPrompt;

    if (userProfile) {
      systemPrompt += "\n\n=== USER CONTEXT ===\n";
      if (userProfile.name) systemPrompt += `Name: ${userProfile.name}\n`;
      if (userProfile.age) systemPrompt += `Age: ${userProfile.age}\n`;
      
      // Dynamic profile building to include all relevant fields
      if (userProfile.gender) systemPrompt += `Gender: ${userProfile.gender}\n`;
      if (userProfile.pronouns) systemPrompt += `Pronouns: ${userProfile.pronouns}\n`;
      
      if (userProfile.occupationType || userProfile.occupation) {
        systemPrompt += `Occupation: ${userProfile.occupationType || userProfile.occupation}\n`;
      }
      
      if (userProfile.jobTitle) systemPrompt += `Job Title: ${userProfile.jobTitle}\n`;
      if (userProfile.organization) systemPrompt += `Organization: ${userProfile.organization}\n`;
      
      if (userProfile.course) systemPrompt += `Course: ${userProfile.course}\n`;
      if (userProfile.branch) systemPrompt += `Branch: ${userProfile.branch}\n`;
      if (userProfile.currentMood) systemPrompt += `Current Mood: ${userProfile.currentMood}\n`;
      
      const concerns = userProfile.concerns || userProfile.primaryConcerns;
      if (concerns) systemPrompt += `Primary Concerns: ${concerns}\n`;
      
      if (userProfile.communicationStyle) systemPrompt += `Preferred Communication Style: ${userProfile.communicationStyle}\n`;
      if (userProfile.preferredRole) systemPrompt += `Preferred Interaction Role: ${userProfile.preferredRole}\n`;
      
      if (userProfile.previousTherapy) systemPrompt += `Previous Therapy: ${userProfile.previousTherapy}\n`;
      if (userProfile.aboutMe) systemPrompt += `About Me: ${userProfile.aboutMe}\n`;
    }

    systemPrompt += "\n\n=== MULTI-AGENT SYSTEM CONTEXT ===\n";
    systemPrompt += `You are part of a multi-agent system. You are: ${agent.name} (${agent.role})\n`;
    systemPrompt += "Other available agents:\n";
    for (const [key, otherAgent] of Object.entries(agents)) {
      if (key !== agent.role) {
        systemPrompt += `- ${otherAgent.name}: ${otherAgent.expertise.join(", ")}\n`;
      }
    }
    systemPrompt += "\nIf the user's needs shift to another agent's expertise, acknowledge this naturally in your response. The system will route appropriately.\n";

    return systemPrompt;
  }

  async getMCPContext(agent, userMessage) {
    if (!this.mcpClient) return "";

    let context = "\n\n=== AVAILABLE KNOWLEDGE (via MCP) ===\n";

    try {
      if (agent.role === "crisis-counselor") {
        const crisisRes = await this.mcpClient.callTool("get_crisis_resources", { country: "US" });
        context += `\nCRISIS RESOURCES:\n${JSON.stringify(crisisRes.result, null, 2)}\n`;
      }

      if (agent.role === "cbt-therapist") {
        const techniques = ["thought-challenging", "behavioral-activation", "problem-solving", "exposure-therapy"];
        for (const technique of techniques) {
          if (userMessage.toLowerCase().includes(technique.replace("-", " "))) {
            const techData = await this.mcpClient.callTool("get_cbt_technique", { technique });
            context += `\nCBT TECHNIQUE - ${technique}:\n${JSON.stringify(techData.result, null, 2)}\n`;
            break;
          }
        }
      }

      if (agent.role === "mindfulness-coach") {
        const strategies = await this.mcpClient.callTool("recommend_coping_strategies", {
          condition: "anxiety",
          urgency: "immediate",
          limit: 3,
        });
        context += `\nRECOMMENDED COPING STRATEGIES:\n${JSON.stringify(strategies.result, null, 2)}\n`;
      }

      if (userMessage.length > 10) {
        const searchResults = await this.mcpClient.callTool("search_mental_health_topics", {
          query: userMessage,
          limit: 2,
        });
        if (searchResults.result.resultsCount > 0) {
          context += `\nRELEVANT MENTAL HEALTH INFORMATION:\n${JSON.stringify(searchResults.result, null, 2)}\n`;
        }
      }
    } catch (error) {
      console.warn("Failed to fetch MCP context:", error.message);
      context += "\n(Note: Some knowledge resources temporarily unavailable)\n";
    }

    return context;
  }

  _recordAgentSelection(agentRole, reason) {
    this.conversationContext.agentHistory.push({
      agent: agentRole,
      reason,
      timestamp: new Date().toISOString(),
    });
    this.conversationContext.lastAgentSwitch = new Date().toISOString();
  }

  getAgentEmotion() {
    return this.activeAgent?.emotion || "empathy";
  }

  getAgentMetadata() {
    return {
      agentName: this.activeAgent?.name || "Companion",
      agentRole: this.activeAgent?.role || "companion",
      agentEmotion: this.getAgentEmotion(),
      expertise: this.activeAgent?.expertise || [],
      agentHistory: this.conversationContext.agentHistory,
    };
  }
}

export default AgentOrchestrator;
