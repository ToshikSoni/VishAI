import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { Lipsync } from "../utils/lipsync";

export class VRMAvatar {
  private container: HTMLElement;
  private vrm: VRM | null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private lipsync: Lipsync | null;
  private isAnimating: boolean;
  private blinkTimer: number;
  private idleTimer: number;
  private breathingPhase: number;
  private currentVisemeWeights: { [key: string]: number };
  private targetVisemeWeights: { [key: string]: number };
  private currentEmotion: string | null;
  private isBlinking: boolean;
  private blinkProgress: number;
  private blinkDuration: number;
  private hasWaved: boolean;
  private isPlayingGesture: boolean;

  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
    this.vrm = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20); // Aspect ratio updated in init
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.clock = new THREE.Clock();
    this.lipsync = null;
    this.isAnimating = false;
    this.blinkTimer = 0;
    this.idleTimer = 0;
    this.breathingPhase = 0;
    this.currentVisemeWeights = { aa: 0, e: 0, ih: 0, oh: 0, ou: 0 };
    this.targetVisemeWeights = { aa: 0, e: 0, ih: 0, oh: 0, ou: 0 };
    this.currentEmotion = null;
    this.isBlinking = false;
    this.blinkProgress = 0;
    this.blinkDuration = 0.15; // seconds
    this.hasWaved = false;
    this.isPlayingGesture = false;
    
    this._init();
  }

  private _init(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20);
    this.camera.position.set(0, 1.3, 1.5);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1, 1, 1).normalize();
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    window.addEventListener("resize", () => this._onResize());
  }

  public async loadVRM(url: string): Promise<VRM> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(url);
      if (this.vrm) {
        VRMUtils.deepDispose(this.vrm.scene);
        this.scene.remove(this.vrm.scene);
      }

      this.vrm = gltf.userData.vrm;
      if (this.vrm) {
        VRMUtils.rotateVRM0(this.vrm);
        this.scene.add(this.vrm.scene);
        this.vrm.scene.rotation.y = 0;
        
        this._setupIdlePose();
        
        if (!this.isAnimating) {
          this.isAnimating = true;
          this._animate();
        }

        setTimeout(() => this._playWaveGesture(), 500);

        console.log("VRM loaded successfully");
        return this.vrm;
      }
      throw new Error("VRM not found in GLTF user data");
    } catch (error) {
      console.error("Error loading VRM:", error);
      throw error;
    }
  }

  public connectLipsync(audioElement: HTMLAudioElement): void {
    if (!this.lipsync) {
      this.lipsync = new Lipsync();
    }
    this.lipsync.connectAudio(audioElement);
  }

  public disconnectLipsync(): void {
    if (this.lipsync) {
      this.lipsync.disconnect();
    }
  }

  private _updateLipsync(deltaTime: number): void {
    if (!this.vrm || !this.lipsync) {
      Object.keys(this.targetVisemeWeights).forEach(key => {
        this.targetVisemeWeights[key] = 0;
      });
      return;
    }

    this.lipsync.processAudio();
    const viseme = this.lipsync.viseme;
    const volume = this.lipsync.getAverageVolume(0, 60);

    const visemeMap: { [key: string]: string } = {
      A: "aa",
      E: "ee",
      I: "ih", 
      O: "oh",
      U: "ou",
    };

    // Fast decay for current target viseme to ensure mouth closes between syllables
    Object.keys(this.targetVisemeWeights).forEach(key => {
      this.targetVisemeWeights[key] = 0;
    });

    if (viseme && visemeMap[viseme]) {
      const vrmShape = visemeMap[viseme];
      // Increase responsiveness: use square of volume ratio to emphasize louder parts and reduce noise
      const normalizedVol = Math.min(1.0, volume / 100); 
      const weight = normalizedVol * normalizedVol * 1.5; // Scale up a bit but curve it
      // Cap at 0.75 (75% open) to prevent mouth opening "too much"
      this.targetVisemeWeights[vrmShape] = Math.min(0.75, weight);
    }

    const blendShapes = this.vrm.expressionManager;
    if (!blendShapes) return;

    // Faster lerp for snappier movement
    const lerpSpeed = 0.5; 
    
    Object.keys(this.currentVisemeWeights).forEach(key => {
      // If target is 0 (mouth closing), close faster
      const speed = this.targetVisemeWeights[key] < this.currentVisemeWeights[key] ? 0.6 : 0.4;
      
      this.currentVisemeWeights[key] += 
        (this.targetVisemeWeights[key] - this.currentVisemeWeights[key]) * speed;
      
      // Threshold to snap to closed to avoid "hanging open"
      if (this.currentVisemeWeights[key] < 0.05) this.currentVisemeWeights[key] = 0;

      try {
        blendShapes.setValue(key, this.currentVisemeWeights[key]);
      } catch (e) {}
    });
  }

  private _updateBlink(deltaTime: number): void {
    if (!this.vrm) return;

    this.blinkTimer += deltaTime;

    const blendShapes = this.vrm.expressionManager;
    if (!blendShapes) return;

    if (this.isBlinking) {
      this.blinkProgress += deltaTime;
      const progress = Math.min(this.blinkProgress / this.blinkDuration, 1);
      
      // Smooth blink using sine wave (0 -> 1 -> 0)
      const blinkWeight = Math.sin(progress * Math.PI);
      
      try {
        blendShapes.setValue("blink", blinkWeight);
      } catch (e) {
        try {
          blendShapes.setValue("blinkLeft", blinkWeight);
          blendShapes.setValue("blinkRight", blinkWeight);
        } catch (e2) {}
      }

      if (progress >= 1) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
      return;
    }

    // Random blink interval between 2 and 6 seconds
    const blinkInterval = 2 + Math.random() * 4;
    
    if (this.blinkTimer > blinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
    }
  }

  private _updateIdleAnimation(deltaTime: number): void {
    if (!this.vrm) return;

    this.idleTimer += deltaTime;
    this.breathingPhase += deltaTime * 0.8;

    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const chest = humanoid.getNormalizedBoneNode("chest");
    const head = humanoid.getNormalizedBoneNode("head");

    const breathingAmount = Math.sin(this.breathingPhase) * 0.05; // Increased breathing
    
    if (chest) {
      chest.rotation.x = breathingAmount;
    }

    if (head) {
      const headSway = Math.sin(this.idleTimer * 0.5) * 0.08; // Increased sway
      head.rotation.y = headSway;
      head.rotation.x = Math.sin(this.idleTimer * 0.3) * 0.04; // Increased nod-sway
    }

    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    
    // Correct rotation to bring arms DOWN from T-pose
    // For Left Arm (+X), -Z rotation moves it down (-Y)
    // For Right Arm (-X), +Z rotation moves it down (-Y)
    const baseArmRotation = 1.3; // ~75 degrees

    if (leftUpperArm && !this.isPlayingGesture) {
      // Invert Z rotation to point down
      leftUpperArm.rotation.z = -baseArmRotation + Math.sin(this.idleTimer * 0.7) * 0.05; 
      leftUpperArm.rotation.x = 0.05;
    }
    if (rightUpperArm && !this.isPlayingGesture) {
      // Invert Z rotation to point down
      rightUpperArm.rotation.z = baseArmRotation + Math.sin(this.idleTimer * 0.7 + Math.PI) * 0.05;
      rightUpperArm.rotation.x = 0.05;
    }
  }

  private _setupIdlePose(): void {
    if (!this.vrm) return;

    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");

    if (leftUpperArm) {
      leftUpperArm.rotation.z = -1.3; // -Z brings Left Arm Down
      leftUpperArm.rotation.x = 0.05;
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = 1.3; // +Z brings Right Arm Down
      rightUpperArm.rotation.x = 0.05;
    }
    if (leftLowerArm) {
      leftLowerArm.rotation.z = 0.05;
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.z = -0.05;
    }
  }

  public playWaveGesture(): void {
    this._playWaveGesture();
  }

  private _playWaveGesture(): void {
    if (!this.vrm || this.hasWaved) return;
    this.hasWaved = true;
    this.isPlayingGesture = true;

    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
    const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
    const rightHand = humanoid.getNormalizedBoneNode("rightHand");
    
    if (!rightUpperArm || !rightLowerArm || !rightHand) return;

    const originalUpperArmRotation = rightUpperArm.rotation.clone();
    const originalLowerArmRotation = rightLowerArm.rotation.clone();
    const originalHandRotation = rightHand.rotation.clone();

    // Slower wave (4 seconds)
    const duration = 4000;
    const startTime = Date.now();

    const animateWave = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing functions for smoother movement
      const easeOutQuad = (x: number): number => 1 - (1 - x) * (1 - x);
      const easeInQuad = (x: number): number => x * x;
      const easeInOutQuad = (x: number): number => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

      if (progress < 0.3) {
        // Raise hand
        const t = easeOutQuad(progress / 0.3);
        // Lower elbow position (0.8 instead of -0.1) to keep arm closer to body
        rightUpperArm.rotation.z = THREE.MathUtils.lerp(originalUpperArmRotation.z, 0.8, t); 
        // Forward tilt (0.5) to bring hand forward
        rightUpperArm.rotation.x = THREE.MathUtils.lerp(originalUpperArmRotation.x, 0.5, t); 
        // Increased elbow bend (-2.2 instead of -1.2) to compensate for lower elbow
        rightLowerArm.rotation.z = THREE.MathUtils.lerp(originalLowerArmRotation.z, -2.2, t);
        
        // Rotate hand to face forward (supinate)
        // Adjust these values based on the initial orientation.
        // If palm faces "Pinky side" to viewer, we need to rotate around Y (Twist) or Local X.
        // If Local X is the bone axis (common in Unity/VRM), rotating X twists the wrist.
        // We want to rotate -90 degrees on X to turn palm to camera.
        rightHand.rotation.x = THREE.MathUtils.lerp(originalHandRotation.x, -Math.PI / 2, t); 
        rightHand.rotation.y = THREE.MathUtils.lerp(originalHandRotation.y, 0, t); 
        rightHand.rotation.z = THREE.MathUtils.lerp(originalHandRotation.z, 0, t);
      } else if (progress < 0.7) {
        // Wave - Use time for Sine wave to keep it continuous
        const waveTime = (progress - 0.3) / 0.4;
        const wave = Math.sin(waveTime * Math.PI * 5) * 0.3; 
        
        // Maintain the lowered position
        rightUpperArm.rotation.z = 0.8;
        rightUpperArm.rotation.x = 0.5;
        rightLowerArm.rotation.z = -2.2 + wave;
        
        // Maintain hand rotation
        rightHand.rotation.x = -Math.PI / 2;
        rightHand.rotation.y = 0;
        
      } else {
        // Lower hand
        const t = easeInQuad((progress - 0.7) / 0.3);
        rightUpperArm.rotation.z = THREE.MathUtils.lerp(0.8, originalUpperArmRotation.z, t);
        rightUpperArm.rotation.x = THREE.MathUtils.lerp(0.5, originalUpperArmRotation.x, t);
        rightLowerArm.rotation.z = THREE.MathUtils.lerp(-2.2, originalLowerArmRotation.z, t);
        
        // Reset hand rotation
        rightHand.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, originalHandRotation.x, t);
        rightHand.rotation.y = THREE.MathUtils.lerp(0, originalHandRotation.y, t);
      }

      if (progress < 1) {
        requestAnimationFrame(animateWave);
      } else {
        this.isPlayingGesture = false;
        rightUpperArm.rotation.copy(originalUpperArmRotation);
        rightLowerArm.rotation.copy(originalLowerArmRotation);
        rightHand.rotation.copy(originalHandRotation);
      }
    };

    animateWave();

    const expressionManager = this.vrm.expressionManager;
    if (expressionManager) {
      try {
        expressionManager.setValue("happy", 0.6);
        setTimeout(() => {
          try {
            expressionManager.setValue("happy", 0);
          } catch (e) {}
        }, duration);
      } catch (e) {}
    }
  }

  public setEmotion(emotion: string): void {
    if (!this.vrm) return;
    
    this.currentEmotion = emotion;
    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) return;

    const emotionMap: { [key: string]: string } = {
      happy: "happy",
      sad: "sad",
      angry: "angry",
      surprised: "surprised",
      neutral: "neutral",
      relaxed: "relaxed",
    };

    try {
      Object.values(emotionMap).forEach(exp => {
        try {
          expressionManager.setValue(exp, 0);
        } catch (e) {}
      });
    } catch (e) {}

    if (emotion && emotionMap[emotion.toLowerCase()]) {
      try {
        const expressionName = emotionMap[emotion.toLowerCase()];
        expressionManager.setValue(expressionName, 0.7);
      } catch (e) {
        console.warn(`Expression ${emotion} not available`);
      }
    }
  }

  private _animate(): void {
    if (!this.isAnimating) return;

    requestAnimationFrame(() => this._animate());

    const deltaTime = this.clock.getDelta();

    if (this.vrm) {
      this.vrm.update(deltaTime);
    }
    
    this._updateLipsync(deltaTime);
    this._updateBlink(deltaTime);
    this._updateIdleAnimation(deltaTime);

    this.renderer.render(this.scene, this.camera);
  }

  private _onResize(): void {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public playIdleGesture(): void {
    if (!this.vrm) return;

    const expressionManager = this.vrm.expressionManager;
    if (expressionManager) {
      try {
        expressionManager.setValue("happy", 0.3);
        setTimeout(() => {
          try {
            expressionManager.setValue("happy", 0);
          } catch (e) {}
        }, 2000);
      } catch (e) {}
    }
  }

  public playNodGesture(): void {
    if (!this.vrm || this.isPlayingGesture) return;
    this.isPlayingGesture = true;

    const humanoid = this.vrm.humanoid;
    if (!humanoid) {
      this.isPlayingGesture = false;
      return;
    }

    const head = humanoid.getNormalizedBoneNode("head");
    if (!head) {
      this.isPlayingGesture = false;
      return;
    }

    const originalRotation = head.rotation.x;
    const duration = 1000;
    const startTime = Date.now();

    const animateNod = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const nodAmount = Math.sin(progress * Math.PI * 2) * 0.15;
      head.rotation.x = originalRotation + nodAmount;

      if (progress < 1) {
        requestAnimationFrame(animateNod);
      } else {
        head.rotation.x = originalRotation;
        this.isPlayingGesture = false;
      }
    };

    animateNod();
  }

  public setExpression(expressionName: string, value: number = 1.0, duration: number = 2000): void {
    if (!this.vrm) return;

    const expressionManager = this.vrm.expressionManager;
    if (expressionManager) {
      try {
        expressionManager.setValue(expressionName, value);
        if (duration > 0) {
          setTimeout(() => {
            try {
              expressionManager.setValue(expressionName, 0);
            } catch (e) {}
          }, duration);
        }
      } catch (e) {
        console.warn(`Expression ${expressionName} not found`);
      }
    }
  }

  public dispose(): void {
    this.isAnimating = false;
    this.disconnectLipsync();
    
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
