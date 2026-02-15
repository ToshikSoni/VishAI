/**
 * Azure Speech Text-to-Speech Avatar Service (Real-Time WebRTC)
 * Provides configuration for real-time avatar synthesis with lip-sync
 * Frontend uses Speech SDK + WebRTC for actual streaming
 */

const axios = require('axios');

class AzureSpeechAvatarService {
  constructor() {
    this.speechKey = process.env.AZURE_SPEECH_KEY;
    this.speechRegion = process.env.AZURE_SPEECH_REGION || 'westus2';
    this.endpoint = `https://${this.speechRegion}.tts.speech.microsoft.com`;
    
    // Default avatar configuration (Lisa graceful-sitting)
    this.defaultAvatar = {
      character: 'lisa',
      style: 'graceful-sitting',
      voice: 'en-US-AvaMultilingualNeural',
    };
  }

  /**
   * Get ICE server token for WebRTC connection
   * Frontend needs this to establish peer connection with Azure Speech
   * @returns {Promise<{iceServers: Array}>}
   */
  async getICEServerConfig() {
    try {
      const url = `${this.endpoint}/cognitiveservices/avatar/relay/token/v1`;
      
      const response = await axios.get(url, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.speechKey,
        },
      });

      const { Urls, Username, Password } = response.data;

      return {
        iceServers: [
          {
            urls: Urls,
            username: Username,
            credential: Password,
          },
        ],
      };
    } catch (error) {
      console.error('❌ Failed to get ICE server config:', error.message);
      throw error;
    }
  }

  /**
   * Get avatar configuration for frontend
   * Used by Speech SDK in browser to initialize avatar
   * @param {string} agentRole - Agent role for voice customization
   * @returns {object} Avatar config
   */
  getAvatarConfig(agentRole = null) {
    // Map agent roles to voice styles (can be enhanced with different voices per agent)
    const voiceMap = {
      'crisis-counselor': 'en-US-JennyNeural', // Calm, empathetic
      'cbt-therapist': 'en-US-AvaMultilingualNeural', // Thoughtful, professional
      'mindfulness-coach': 'en-US-SaraNeural', // Soothing, gentle
      'companion': 'en-US-AvaMultilingualNeural', // Friendly, warm
    };

    return {
      character: this.defaultAvatar.character,
      style: this.defaultAvatar.style,
      voice: voiceMap[agentRole] || this.defaultAvatar.voice,
      videoFormat: {
        crop: null, // Can add cropping if needed
        backgroundColor: '#F0F4F8', // Soft blue-grey background
      },
    };
  }

  /**
   * Build SSML for avatar synthesis with agent-specific styling
   * @param {string} text - Text to synthesize
   * @param {string} agentRole - Agent role for emotional expression
   * @returns {string} SSML string
   */
  buildSSML(text, agentRole = null) {
    const voice = this.getAvatarConfig(agentRole).voice;
    
    // Map agent roles to speaking styles
    const styleMap = {
      'crisis-counselor': 'calm',
      'cbt-therapist': 'professional',
      'mindfulness-coach': 'gentle',
      'companion': 'friendly',
    };
    
    const style = styleMap[agentRole] || 'friendly';

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
             xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${voice}">
          <mstts:express-as style="${style}">
            ${this._escapeXml(text)}
          </mstts:express-as>
        </voice>
      </speak>
    `.trim();
  }

  /**
   * Get available standard avatars
   */
  getAvailableAvatars() {
    return {
      videoAvatars: [
        { character: 'lisa', styles: ['casual-sitting', 'graceful-sitting', 'technical-sitting'] },
        { character: 'harry', styles: ['business', 'casual', 'youthful'] },
        { character: 'jeff', styles: ['business', 'formal'] },
        { character: 'lori', styles: ['casual', 'graceful', 'formal'] },
        { character: 'max', styles: ['business', 'casual', 'formal'] },
        { character: 'meg', styles: ['formal', 'casual', 'business'] },
      ],
      photoAvatars: [
        'adrian', 'amara', 'amira', 'anika', 'bianca', 'camila', 'carlos', 'clara',
        'darius', 'diego', 'elise', 'farhan', 'faris', 'gabrielle', 'hyejin', 'imran',
        'isabella', 'layla', 'liwei', 'ling', 'marcus', 'matteo', 'rahul', 'rana',
        'ren', 'riya', 'sakura', 'simone', 'zayd', 'zoe',
      ],
    };
  }

  /**
   * Escape XML special characters
   * @private
   */
  _escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = AzureSpeechAvatarService;
