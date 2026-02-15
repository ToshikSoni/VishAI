/**
 * Azure Speech TTS Avatar Manager
 * Handles real-time avatar video synthesis with WebRTC + Speech SDK
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import { API_URL } from '../config/api.js';

export class AvatarManager {
  constructor() {
    this.peerConnection = null;
    this.avatarSynthesizer = null;
    this.videoElement = null;
    this.audioElement = null;
    this.isConnected = false;
    this.speechConfig = null;
    this.avatarConfig = null;
    this.iceConfig = null;
  }

  /**
   * Initialize avatar system with WebRTC connection
   * @param {HTMLVideoElement} videoElement - Video player for avatar
   * @param {HTMLAudioElement} audioElement - Audio player for avatar voice
   */
  async initialize(videoElement, audioElement) {
    try {
      this.videoElement = videoElement;
      this.audioElement = audioElement;

      console.log('🎭 Initializing Azure Speech Avatar...');

      // Step 1: Fetch avatar configuration from backend
      const configResponse = await fetch(`${API_URL}/avatar/config`);
      if (!configResponse.ok) {
        throw new Error('Failed to fetch avatar config');
      }
      const config = await configResponse.json();
      
      this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        config.speechKey,
        config.speechRegion
      );
      this.speechConfig.speechSynthesisLanguage = 'en-US';
      this.speechConfig.speechSynthesisVoiceName = config.voice;

      this.avatarConfig = new SpeechSDK.AvatarConfig(
        config.character,
        config.style
      );
      
      // Set background color
      if (config.videoFormat?.backgroundColor) {
        this.avatarConfig.backgroundColor = config.videoFormat.backgroundColor;
      }

      // Step 2: Fetch ICE server configuration
      const iceResponse = await fetch(`${API_URL}/avatar/ice-config`);
      if (!iceResponse.ok) {
        throw new Error('Failed to fetch ICE config');
      }
      this.iceConfig = await iceResponse.json();

      // Step 3: Create WebRTC peer connection
      this.peerConnection = new RTCPeerConnection(this.iceConfig);

      // Step 4: Set up video/audio streams
      this.peerConnection.ontrack = (event) => {
        console.log(`📺 Received ${event.track.kind} track`);
        
        if (event.track.kind === 'video') {
          if (this.videoElement) {
            this.videoElement.srcObject = event.streams[0];
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
          }
        }

        if (event.track.kind === 'audio') {
          if (this.audioElement) {
            this.audioElement.srcObject = event.streams[0];
            this.audioElement.autoplay = true;
          }
        }
      };

      // Offer to receive video and audio tracks
      this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
      this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

      // Step 5: Create avatar synthesizer
      this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(
        this.speechConfig,
        this.avatarConfig
      );

      // Step 6: Start avatar session with WebRTC connection
      await this.avatarSynthesizer.startAvatarAsync(this.peerConnection);
      
      this.isConnected = true;
      console.log('✅ Avatar connected and ready!');

      return true;
    } catch (error) {
      console.error('❌ Avatar initialization failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Speak text using the avatar
   * @param {string} text - Text to synthesize
   * @returns {Promise<void>}
   */
  async speakText(text) {
    if (!this.isConnected || !this.avatarSynthesizer) {
      console.warn('⚠️ Avatar not connected, cannot speak');
      return;
    }

    try {
      console.log(`🗣️ Avatar speaking: ${text.substring(0, 50)}...`);
      
      return new Promise((resolve, reject) => {
        this.avatarSynthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('✅ Avatar speech completed');
resolve();
            } else {
              console.error('❌ Avatar speech failed:', result.errorDetails);
              reject(new Error(result.errorDetails));
            }
          },
          (error) => {
            console.error('❌ Avatar speech error:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('❌ Error speaking with avatar:', error);
      throw error;
    }
  }

  /**
   * Speak SSML using the avatar (for advanced voice control)
   * @param {string} ssml - SSML string to synthesize
   * @returns {Promise<void>}
   */
  async speakSSML(ssml) {
    if (!this.isConnected || !this.avatarSynthesizer) {
      console.warn('⚠️ Avatar not connected, cannot speak');
      return;
    }

    try {
      console.log('🗣️ Avatar speaking with SSML');
      
      return new Promise((resolve, reject) => {
        this.avatarSynthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              console.log('✅ Avatar SSML speech completed');
              resolve();
            } else {
              console.error('❌ Avatar SSML speech failed:', result.errorDetails);
              reject(new Error(result.errorDetails));
            }
          },
          (error) => {
            console.error('❌ Avatar SSML speech error:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('❌ Error speaking SSML with avatar:', error);
      throw error;
    }
  }

  /**
   * Stop current speech
   */
  stopSpeaking() {
    if (this.avatarSynthesizer) {
      this.avatarSynthesizer.stopSpeakingAsync();
      console.log('⏹️ Avatar stopped speaking');
    }
  }

  /**
   * Close avatar connection
   */
  async close() {
    if (this.avatarSynthesizer) {
      await this.avatarSynthesizer.close();
      this.avatarSynthesizer = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isConnected = false;
    console.log('👋 Avatar connection closed');
  }

  /**
   * Check if avatar is currently speaking
   * @returns {boolean}
   */
  isSpeaking() {
    // Note: Speech SDK doesn't expose speaking state directly
    // You might need to track this manually
    return this.isConnected;
  }
}
