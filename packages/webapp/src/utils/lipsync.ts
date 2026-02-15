export class Lipsync {
  private audioContext: AudioContext | null;
  private analyser: AnalyserNode | null;
  private audioElement: HTMLAudioElement | null;
  private dataArray: Uint8Array | null;
  private bufferLength: number;
  public viseme: string | null;
  public isConnected: boolean;
  public currentVolume: number;

  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.audioElement = null;
    this.dataArray = null;
    this.bufferLength = 0;
    this.viseme = null;
    this.isConnected = false;
    this.currentVolume = 0;
  }

  public connectAudio(audioElement: HTMLAudioElement): void {
    if (this.isConnected) {
      this.disconnect();
    }

    this.audioElement = audioElement;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    
    if (this.audioContext) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaElementSource(audioElement);
      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }

      this.bufferLength = this.analyser ? this.analyser.frequencyBinCount : 0;
      this.dataArray = new Uint8Array(this.bufferLength);
      this.isConnected = true;
    }
  }

  public disconnect(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn("Error closing audio context:", e);
      }
    }
    this.audioContext = null;
    this.analyser = null;
    this.audioElement = null;
    this.dataArray = null;
    this.viseme = null;
    this.isConnected = false;
  }

  public processAudio(): void {
    if (!this.analyser || !this.dataArray) {
      this.viseme = null;
      this.currentVolume = 0;
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    const lowFreq = this.getAverageVolume(0, 10);
    const midFreq = this.getAverageVolume(10, 30);
    const highFreq = this.getAverageVolume(30, 60);
    const totalVolume = (lowFreq * 0.8 + midFreq + highFreq * 0.5) / 2.3; // Weighted average

    // Smooth volume slightly less effectively to allow faster drops
    this.currentVolume = this.currentVolume * 0.3 + totalVolume * 0.7;

    if (this.currentVolume < 15) { // Increased threshold to filter noise
      this.viseme = null;
      return;
    }

    // Enhance Vowel differentiation
    // A: Low dominant
    // I: High/Mid dominant
    // U: Low/High balanced
    // E: Mid dominant
    // O: Low/Mid balanced

    if (lowFreq > midFreq && lowFreq > highFreq) {
      if (midFreq > highFreq * 1.5) { this.viseme = "O"; } // Low & Mid -> O
      else { this.viseme = "A"; } // Just Low -> A
    } else if (midFreq > lowFreq && midFreq > highFreq) {
      if (highFreq > lowFreq) { this.viseme = "I"; } // Mid & High -> I (ee)
      else { this.viseme = "E"; } // Just Mid -> E (eh)
    } else {
      this.viseme = "U"; // High/mixed -> U (oo)
    }
  }

  public getAverageVolume(startIndex: number, endIndex: number): number {
    if (!this.dataArray || !this.bufferLength) return 0;
    
    let sum = 0;
    const count = Math.min(endIndex, this.bufferLength) - startIndex;
    if (count <= 0) return 0;
    
    for (let i = startIndex; i < Math.min(endIndex, this.bufferLength); i++) {
      sum += this.dataArray[i];
    }
    
    return sum / count;
  }
}
