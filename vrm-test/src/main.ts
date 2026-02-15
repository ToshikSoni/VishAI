import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const container = document.getElementById('container') as HTMLElement;
const status = document.getElementById('status') as HTMLElement;

// Create Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(
  30,
  container.clientWidth / container.clientHeight,
  0.1,
  50
);
camera.position.set(0, 1.4, 1.5);
camera.lookAt(0, 1.3, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Load VRM
const loader = new GLTFLoader();
loader.crossOrigin = 'anonymous';

loader.register((parser) => {
  return new VRMLoaderPlugin(parser);
});

status.textContent = '✅ TypeScript + VRM Setup Works!';
status.style.color = '#10b981';

let vrm: any = null;
const clock = new THREE.Clock();

// Try to load avatar
loader.load(
  './avatar.vrm',
  (gltf) => {
    vrm = gltf.userData.vrm;
    if (vrm) {
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      scene.add(vrm.scene);
      status.textContent = '🎉 VRM Avatar Loaded!';
      console.log('VRM loaded:', vrm);
      console.log('Expressions:', vrm.expressionManager?.expressionMap);
    }
  },
  (progress) => {
    console.log('Loading:', (progress.loaded / progress.total * 100).toFixed(0) + '%');
  },
  (error) => {
    console.warn('No avatar found:', error);
    status.textContent = '📦 Add avatar.vrm to public folder';
    status.style.color = '#f59e0b';
    
    // Create placeholder
    const geometry = new THREE.BoxGeometry(0.4, 0.8, 0.4);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x667eea,
      roughness: 0.5
    });
    const placeholder = new THREE.Mesh(geometry, material);
    placeholder.position.set(0, 1.2, 0);
    scene.add(placeholder);
  }
);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta();
  
  if (vrm) {
    vrm.update(deltaTime);
    
    // Test expressions
    const time = performance.now() * 0.001;
    if (vrm.expressionManager) {
      const happy = (Math.sin(time) + 1) * 0.5;
      vrm.expressionManager.setValue('happy', happy * 0.6);
    }
  }
  
  renderer.render(scene, camera);
}

animate();

// Handle resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});
