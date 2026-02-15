import { LitElement, html, css } from "lit";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

/**
 * Cute Anime Avatar Component with VRM support, emotions and lip sync
 */
export class AvatarComponent extends LitElement {
  static properties = {
    emotion: { type: String },
    isSpeaking: { type: Boolean },
    isListening: { type: Boolean },
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    #avatar-container {
      width: 100%;
      height: 100%;
      border-radius: 12px;
      overflow: hidden;
      background: linear-gradient(135deg, #ffc3e0 0%, #ffb3d9 100%);
      cursor: grab;
    }
    
    #avatar-container:active {
      cursor: grabbing;
    }

    .avatar-status {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.9);
      color: #ff69b4;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-family: 'Quicksand', sans-serif;
      font-weight: 600;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      user-select: none;
      pointer-events: none;
    }
  `;

  // Class properties (non-reactive)
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera | null = null;
  renderer: THREE.WebGLRenderer | null = null;
  controls: OrbitControls | null = null;
  vrm: any = null;
  audioContext: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  animationId: number | null = null;
  clock: THREE.Clock = new THREE.Clock();
  blinkTimer: number = 0;

  constructor() {
    super();
    // Reactive properties initialized
    this.emotion = "neutral";
    this.isSpeaking = false;
    this.isListening = false;
  }

  firstUpdated() {
    this.initThreeJS();
    this.loadVRMAvatar();
  }

  initThreeJS() {
    const container = this.shadowRoot!.getElementById("avatar-container") as HTMLElement;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeeeeee); // Light gray background
    
    console.log("🎬 Three.js scene initialized");
    console.log("📦 Container size:", container.clientWidth, "x", container.clientHeight);
    
    this.camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    this.camera.position.set(0, 1.3, 0.8);
    this.camera.lookAt(0, 1.2, 0);
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(0.5, 1, 1);
    this.scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0xffddf0, 0.6);
    fillLight.position.set(-0.5, 0.5, -0.5);
    this.scene.add(fillLight);
    
    // Mouse controls for rotating avatar
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.2, 0); // Look at head height
    this.controls.enableDamping = true; // Smooth movement
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true; // Allow zoom with scroll
    this.controls.minDistance = 0.5; // Closest zoom
    this.controls.maxDistance = 3; // Farthest zoom
    this.controls.enablePan = false; // Disable panning (only rotate)
    this.controls.maxPolarAngle = Math.PI / 1.5; // Limit vertical rotation
    this.controls.minPolarAngle = Math.PI / 3;
    
    window.addEventListener("resize", () => this.onResize());
    this.animate();
  }

  async loadVRMAvatar() {
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';
    
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });
    
    const vrmUrl = "./avatar.vrm";
    console.log("🔍 Attempting to load VRM from:", vrmUrl);
    
    try {
      console.log("⏳ Loading VRM file...");
      const gltf = await loader.loadAsync(vrmUrl);
      console.log("📦 GLTF loaded:", gltf);
      
      const vrm = gltf.userData.vrm;
      console.log("🤖 VRM data:", vrm);
      
      if (vrm) {
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.removeUnnecessaryJoints(gltf.scene);
        
        vrm.scene.position.set(0, -0.3, 0);
        vrm.scene.rotation.set(0, 0, 0);
        console.log("📍 Adding VRM to scene at position:", vrm.scene.position);
        console.log("📏 VRM scene children:", vrm.scene.children.length);
        
        this.scene!.add(vrm.scene);
        this.vrm = vrm;
        
        console.log("✨ VRM avatar loaded successfully!");
        console.log("📋 Available expressions:", Object.keys(vrm.expressionManager?.expressionMap || {}));
      } else {
        console.error("❌ No VRM data in userData!");
      }
    } catch (error: any) {
      console.error("❌ Failed to load VRM:", error);
      console.log("📝 To add your avatar:");
      console.log("1. Download a free VRM from https://hub.vroid.com/");
      console.log("2. Save it as 'avatar.vrm' in packages/webapp/public/");
      console.log("3. Refresh the page");
      
      this.createPlaceholder();
    }
  }

  createPlaceholder() {
    const geometry = new THREE.CapsuleGeometry(0.3, 1, 16, 32);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xffb3d9,
      roughness: 0.5
    });
    const placeholder = new THREE.Mesh(geometry, material);
    placeholder.position.set(0, 1, 0);
    this.scene!.add(placeholder);
    
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 512;
    textCanvas.height = 256;
    const ctx = textCanvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add avatar.vrm', 256, 128);
    ctx.fillText('to public folder', 256, 170);
    
    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.MeshBasicMaterial({ 
      map: textTexture,
      transparent: true
    });
    const textPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.5),
      textMaterial
    );
    textPlane.position.set(0, 1.8, 0);
    this.scene!.add(textPlane);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    const deltaTime = this.clock.getDelta();
    
    // Update controls for smooth damping
    if (this.controls) {
      this.controls.update();
    }
    
    if (this.vrm) {
      this.vrm.update(deltaTime);
      this.updateEmotion();
      
      if (this.isSpeaking && this.analyser) {
        this.updateLipSync();
      } else {
        this.resetMouth();
      }
      
      this.updateBlinking(deltaTime);
      this.updateIdleAnimation();
    }
    
    this.renderer!.render(this.scene!, this.camera!);
  }

  updateEmotion() {
    if (!this.vrm?.expressionManager) return;
    
    const emotionMap: Record<string, { expression: string; intensity: number }> = {
      happy: { expression: "happy", intensity: 0.8 },
      sad: { expression: "sad", intensity: 0.7 },
      empathy: { expression: "relaxed", intensity: 0.6 },
      concerned: { expression: "sad", intensity: 0.5 },
      encouraging: { expression: "happy", intensity: 0.9 },
      thoughtful: { expression: "neutral", intensity: 0.5 },
      neutral: { expression: "neutral", intensity: 0.3 }
    };
    
    const target = emotionMap[this.emotion] || emotionMap.neutral;
    const mgr = this.vrm.expressionManager;
    
    console.log("🎭 Current emotion:", this.emotion, "→", target.expression, "intensity:", target.intensity);
    
    // Reset all emotions first
    ["happy", "sad", "relaxed", "neutral", "angry", "surprised", "fun"].forEach((e: string) => {
      if (mgr.getExpression(e)) {
        mgr.setValue(e, 0);
      }
    });
    
    if (mgr.getExpression(target.expression)) {
      mgr.setValue(target.expression, target.intensity);
      console.log("✅ Set expression:", target.expression);
    } else {
      console.warn("⚠️ Expression not found:", target.expression);
    }
  }

  updateLipSync() {
    if (!this.analyser || !this.vrm?.expressionManager) return;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    const low = dataArray.slice(0, 30).reduce((a, b) => a + b) / 30;
    const mid = dataArray.slice(30, 100).reduce((a, b) => a + b) / 70;
    const high = dataArray.slice(100, 200).reduce((a, b) => a + b) / 100;
    
    const aValue = Math.min((low / 128) * 1.2, 1);
    const iValue = Math.min((high / 128) * 1.0, 1);
    const uValue = Math.min((mid / 128) * 0.8, 1);
    
    const mgr = this.vrm.expressionManager;
    if (mgr.getExpression("aa")) mgr.setValue("aa", aValue);
    if (mgr.getExpression("ih")) mgr.setValue("ih", iValue);
    if (mgr.getExpression("ou")) mgr.setValue("ou", uValue);
  }

  resetMouth() {
    if (!this.vrm?.expressionManager) return;
    
    const mgr = this.vrm.expressionManager;
    ["aa", "ih", "ou", "ee", "oh"].forEach((shape: string) => {
      if (mgr.getExpression(shape)) {
        const current = mgr.getValue(shape);
        mgr.setValue(shape, current * 0.85);
      }
    });
  }

  updateBlinking(deltaTime: number) {
    if (!this.vrm?.expressionManager) return;
    
    this.blinkTimer += deltaTime;
    
    if (this.blinkTimer > 3 + Math.random() * 2) {
      const mgr = this.vrm.expressionManager;
      if (mgr.getExpression("blink")) {
        mgr.setValue("blink", 1);
        setTimeout(() => {
          if (mgr.getExpression("blink")) {
            mgr.setValue("blink", 0);
          }
        }, 150);
      }
      this.blinkTimer = 0;
    }
  }

  updateIdleAnimation() {
    if (!this.vrm) return;
    
    const time = Date.now() * 0.001;
    const humanoid = this.vrm.humanoid;
    
    // Breathing motion
    this.vrm.scene.position.y = -0.3 + Math.sin(time * 1.5) * 0.015;
    
    // Head movement
    const head = humanoid?.getNormalizedBoneNode("head");
    if (head) {
      if (this.isSpeaking) {
        // More animated head movement when speaking
        head.rotation.y = Math.sin(time * 2.5) * 0.12;
        head.rotation.x = Math.sin(time * 1.8) * 0.08;
        head.rotation.z = Math.cos(time * 2.2) * 0.06;
      } else {
        // Subtle idle head movement
        head.rotation.y = Math.sin(time * 0.5) * 0.08;
        head.rotation.x = Math.sin(time * 0.3) * 0.03;
        head.rotation.z = Math.cos(time * 0.7) * 0.04;
      }
    }
    
    // Spine/chest movement for more natural posture
    const spine = humanoid?.getNormalizedBoneNode("spine");
    if (spine) {
      spine.rotation.y = Math.sin(time * 0.4) * 0.03;
      spine.rotation.z = Math.cos(time * 0.6) * 0.02;
    }
    
    const chest = humanoid?.getNormalizedBoneNode("chest");
    if (chest) {
      chest.rotation.x = Math.sin(time * 1.5) * 0.02; // Breathing
    }
    
    // Arm movements
    const leftUpperArm = humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = humanoid?.getNormalizedBoneNode("rightUpperArm");
    
    if (this.isSpeaking) {
      // Animated gestures when speaking
      if (leftUpperArm) {
        leftUpperArm.rotation.z = Math.sin(time * 2) * 0.15 + 0.3;
        leftUpperArm.rotation.x = Math.cos(time * 1.5) * 0.1 + 0.3;
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z = Math.sin(time * 2.3) * -0.15 - 0.3;
        rightUpperArm.rotation.x = Math.cos(time * 1.8) * 0.1 + 0.3;
      }
    } else {
      // Natural resting position when idle - arms at sides
      if (leftUpperArm) {
        leftUpperArm.rotation.z = Math.sin(time * 0.6) * 0.03 + 0.15;
        leftUpperArm.rotation.x = Math.sin(time * 0.5) * 0.02 + 0.5;
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z = Math.sin(time * 0.65) * -0.03 - 0.15;
        rightUpperArm.rotation.x = Math.sin(time * 0.55) * 0.02 + 0.5;
      }
    }
    
    // Hand movements
    const leftHand = humanoid?.getNormalizedBoneNode("leftHand");
    const rightHand = humanoid?.getNormalizedBoneNode("rightHand");
    
    if (this.isSpeaking) {
      if (leftHand) {
        leftHand.rotation.z = Math.sin(time * 3) * 0.2;
      }
      if (rightHand) {
        rightHand.rotation.z = Math.sin(time * 3.5) * 0.2;
      }
    }
  }

  connectAudio(audioElement: HTMLAudioElement) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
    }
    
    try {
      const source = this.audioContext.createMediaElementSource(audioElement);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (error: any) {
      console.warn("Audio already connected:", error.message);
    }
  }

  setEmotion(emotion: string) {
    console.log("🎯 setEmotion called with:", emotion);
    this.emotion = emotion;
  }

  speak() {
    this.isSpeaking = true;
  }

  stopSpeaking() {
    this.isSpeaking = false;
  }

  listen() {
    this.isListening = true;
  }

  stopListening() {
    this.isListening = false;
  }

  onResize() {
    const container = this.shadowRoot!.getElementById("avatar-container") as HTMLElement;
    if (container && this.camera && this.renderer) {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    window.removeEventListener("resize", () => this.onResize());
  }

  render() {
    return html`
      <div id="avatar-container"></div>
      <div class="avatar-status">
        ${this.isSpeaking ? "💕 Speaking" : 
          this.isListening ? "👂 Listening" : 
          "💭 Ready"}
      </div>
    `;
  }
}

customElements.define("avatar-component", AvatarComponent);
