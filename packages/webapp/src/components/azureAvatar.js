import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export class AzureAvatar {
  constructor(videoElement) {
    this.videoElement = videoElement;
    this.speechRecognizer = null;
    this.avatarSynthesizer = null;
    this.peerConnection = null;
    this.isConnected = false;
    this.isSpeaking = false;
  }

  async connect(region, key, character = "lisa", style = "casual-sitting") {
    if (!region || !key) {
      console.error("Azure Avatar: Region and Key are required.");
      return;
    }

    try {
      // 1. Get ICE Token
      const tokenUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;
      const response = await fetch(tokenUrl, {
        method: "GET",
        headers: { "Ocp-Apim-Subscription-Key": key }
      });

      if (!response.ok) {
        throw new Error(`Failed to get ICE token: ${response.statusText}`);
      }

      const tokenData = await response.json();
      const iceServers = [{
        urls: [tokenData.Urls[0]],
        username: tokenData.Username,
        credential: tokenData.Password
      }];

      // 2. Setup WebRTC
      this.peerConnection = new RTCPeerConnection({ iceServers });

      this.peerConnection.ontrack = (event) => {
        if (event.track.kind === "video") {
          this.videoElement.srcObject = event.streams[0];
          this.videoElement.play().catch(e => console.log("Video play error:", e));
        }
      };

      // Important: Add Transceivers before offer/answer
      this.peerConnection.addTransceiver("video", { direction: "sendrecv" });
      this.peerConnection.addTransceiver("audio", { direction: "sendrecv" });

      // 3. Initialize Avatar Synthesizer
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
      // character and style
      // The reference uses `new SpeechSDK.AvatarConfig(character, style, "transparent")` but the library might differ slightly
      // Let's assume standard usage or check if `AvatarConfig` exists in correct scope
      const avatarConfig = new SpeechSDK.AvatarConfig(character, style, "transparent"); 
      
      this.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

      this.avatarSynthesizer.avatarEventReceived = (s, e) => {
        console.log("Avatar Event:", e.description);
      };

      // 4. Start Avatar
      // Implementation note: The SDK handles the offer/answer exchange internally when `startAvatarAsync` is called with a peer connection.
      const result = await this.avatarSynthesizer.startAvatarAsync(this.peerConnection);

      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        this.isConnected = true;
        console.log("Azure Avatar Connected Successfully");
      } else {
        console.error("Avatar failed to start:", result);
        this.disconnect();
      }

    } catch (error) {
      console.error("Azure Avatar Connection Failed:", error);
      this.disconnect();
    }
  }

  async speak(text) {
    if (!this.isConnected || !this.avatarSynthesizer) return;
    
    this.isSpeaking = true;
    try {
      await this.avatarSynthesizer.speakTextAsync(text);
    } catch (error) {
      console.error("Avatar Speak Error:", error);
    } finally {
      this.isSpeaking = false;
    }
  }

  async stopSpeaking() {
    if (this.avatarSynthesizer) {
      await this.avatarSynthesizer.stopSpeakingAsync();
      this.isSpeaking = false;
    }
  }

  disconnect() {
    if (this.avatarSynthesizer) {
      this.avatarSynthesizer.close();
      this.avatarSynthesizer = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.videoElement) {
        this.videoElement.srcObject = null;
    }
    this.isConnected = false;
  }
}
