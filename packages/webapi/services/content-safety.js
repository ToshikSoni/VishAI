/**
 * Azure Content Safety Integration for VishAI
 * Implements Responsible AI practices for mental health conversations
 */

const { ContentSafetyClient, AzureKeyCredential } = require('@azure/ai-content-safety');

class ContentSafetyService {
  constructor() {
    this.endpoint = process.env.AZURE_CONTENT_SAFETY_ENDPOINT || '';
    this.key = process.env.AZURE_CONTENT_SAFETY_KEY || '';
    this.client = null;
    this.isEnabled = false;
  }

  /**
   * Initialize Content Safety client
   */
  async initialize() {
    try {
      if (!this.endpoint || !this.key) {
        console.warn('⚠️ Content Safety not configured - using basic filtering');
        return;
      }

      this.client = new ContentSafetyClient(
        this.endpoint,
        new AzureKeyCredential(this.key)
      );
      
      this.isEnabled = true;
      console.log('✅ Content Safety initialized');
    } catch (error) {
      console.error('❌ Content Safety initialization failed:', error.message);
    }
  }

  /**
   * Analyze text for harmful content
   */
  async analyzeText(text) {
    // Basic keyword-based filtering (fallback)
    const basicAnalysis = this._basicContentFilter(text);
    
    if (!this.isEnabled || !this.client) {
      return basicAnalysis;
    }

    try {
      const result = await this.client.analyzeText({
        text: text,
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence']
      });

      return {
        isHarmful: this._isAboveThreshold(result),
        categories: result.categoriesAnalysis,
        requiresIntervention: this._requiresCrisisIntervention(result),
        ...basicAnalysis
      };
    } catch (error) {
      console.error('Content Safety analysis error:', error.message);
      return basicAnalysis;
    }
  }

  /**
   * Check if content severity is above threshold
   */
  _isAboveThreshold(result) {
    const threshold = 4; // Medium-high severity
    return result.categoriesAnalysis.some(cat => cat.severity >= threshold);
  }

  /**
   * Determine if crisis intervention is needed
   */
  _requiresCrisisIntervention(result) {
    const selfHarm = result.categoriesAnalysis.find(cat => cat.category === 'SelfHarm');
    return selfHarm && selfHarm.severity >= 4;
  }

  /**
   * Basic content filtering (fallback when Azure service unavailable)
   */
  _basicContentFilter(text) {
    const lowerText = text.toLowerCase();

    // Crisis keywords
    const crisisKeywords = [
      'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
      'better off dead', 'no reason to live', 'end it all', 'self harm',
      'hurt myself', 'overdose'
    ];

    // Hate speech indicators
    const hateIndicators = [
      // Basic profanity filter
      'hate', 'violent threats'
    ];

    // Self-harm detection
    const hasCrisisContent = crisisKeywords.some(keyword => lowerText.includes(keyword));
    const hasHateContent = hateIndicators.some(keyword => lowerText.includes(keyword));

    return {
      isHarmful: hasHateContent,
      requiresIntervention: hasCrisisContent,
      crisisDetected: hasCrisisContent,
      categories: {
        selfHarm: hasCrisisContent ? 'high' : 'low',
        hate: hasHateContent ? 'medium' : 'low'
      }
    };
  }

  /**
   * Validate user input before processing
   */
  async validateInput(text) {
    if (!text || text.trim().length === 0) {
      return { valid: false, reason: 'Empty input' };
    }

    if (text.length > 4000) {
      return { valid: false, reason: 'Input too long (max 4000 characters)' };
    }

    const analysis = await this.analyzeText(text);

    // Allow crisis content (we want to help!)
    // Block only hate speech and abuse
    if (analysis.isHarmful && !analysis.crisisDetected) {
      return {
        valid: false,
        reason: 'Content violates community guidelines',
        requiresModeration: true
      };
    }

    return {
      valid: true,
      crisisDetected: analysis.crisisDetected,
      requiresIntervention: analysis.requiresIntervention
    };
  }

  /**
   * Log content safety event for compliance
   */
  async logSafetyEvent(sessionId, eventType, details) {
    const event = {
      timestamp: new Date().toISOString(),
      sessionId,
      eventType,
      ...details
    };

    console.log('🛡️ Content Safety Event:', JSON.stringify(event));
    
    // In production, send to monitoring/compliance system
    // await this.sendToCompliance(event);
    
    return event;
  }
}

// Singleton instance
const contentSafety = new ContentSafetyService();

module.exports = contentSafety;
