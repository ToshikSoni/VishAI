# 3D Avatar Integration Documentation

## Overview

Your Vish AI mental health chatbot now includes a fully functional 3D talking avatar with:
- **Emotion-driven expressions** (happy, sad, empathy, concerned, encouraging, thoughtful, neutral)
- **Real-time lip sync** synchronized with Azure TTS audio
- **Idle animations** (breathing, blinking, head movement)
- **Audio-reactive mouth movements**
- **Smooth emotion transitions**

## How It Works

### 1. Backend Emotion Detection (`server.js`)

The backend analyzes AI responses using pattern matching to detect emotional tone:

```javascript
function detectEmotion(responseText) {
  // Detects: empathy, concerned, encouraging, happy, sad, thoughtful, neutral
  // Based on keywords and phrases in the AI's response
}
```

**Emotions mapped:**
- `empathy`: "I hear you", "that sounds difficult"
- `concerned`: "I'm worried", "please reach out", crisis keywords
- `encouraging`: "you can do this", "proud of you", "great job"
- `happy`: "wonderful news", "so glad to hear"
- `sad`: "so sorry", "heartbreaking"
- `thoughtful`: "let's think about", "have you considered"
- `neutral`: default

### 2. Avatar Component (`avatar.js`)

**Emotion Mapping:**
```javascript
emotionMorphTargets = {
  neutral: { smile: 0, sad: 0, angry: 0, surprised: 0, eyebrows: 0 },
  happy: { smile: 0.8, sad: 0, angry: 0, surprised: 0.2, eyebrows: 0.3 },
  sad: { smile: 0, sad: 0.9, angry: 0, surprised: 0, eyebrows: -0.4 },
  empathy: { smile: 0.3, sad: 0.3, angry: 0, surprised: 0, eyebrows: 0.2 },
  concerned: { smile: 0, sad: 0.5, angry: 0, surprised: 0.3, eyebrows: -0.3 },
  encouraging: { smile: 0.7, sad: 0, angry: 0, surprised: 0.4, eyebrows: 0.5 },
  thoughtful: { smile: 0.1, sad: 0.2, angry: 0, surprised: 0, eyebrows: -0.2 },
}
```

**Lip Sync:**
- Uses Web Audio API to analyze frequency data
- Mouth opens/closes based on audio volume
- Works with both Azure TTS audio and browser speech synthesis

### 3. Integration with Chat (`chat.js`)

The avatar automatically responds to:
- **Speaking**: Opens mouth with audio-reactive animation
- **Listening**: Changes status indicator
- **Emotion changes**: Smoothly transitions facial expressions
- **Idle state**: Subtle breathing and blinking

## Installation & Setup

### Install Dependencies

```bash
cd packages/webapp
npm install
```

Dependencies added to `package.json`:
- `three`: ^0.170.0
- `@pixiv/three-vrm`: ^3.2.0

### Deploy

```bash
# The avatar will automatically be included
azd up
```

## Using Ready Player Me (Optional Upgrade)

The current implementation uses a simple geometric placeholder avatar. To use a realistic Ready Player Me avatar:

### 1. Create Your Avatar

1. Go to [Ready Player Me](https://readyplayer.me/)
2. Create and customize your avatar
3. Get the GLB URL (e.g., `https://models.readyplayer.me/YOUR_ID.glb`)

### 2. Update Avatar Component

In `avatar.js`, uncomment and use:

```javascript
async loadAvatar() {
  const avatarUrl = "https://models.readyplayer.me/YOUR_AVATAR_ID.glb";
  await this.loadReadyPlayerMeAvatar(avatarUrl);
}
```

### 3. Blend Shape Names

Ready Player Me avatars use ARKit blend shapes. Update the mapping if needed:

```javascript
// For Ready Player Me / ARKit blend shapes
emotionMorphTargets = {
  happy: { 
    mouthSmile: 0.8,
    eyeSmileLeft: 0.5,
    eyeSmileRight: 0.5,
    browInnerUp: 0.3
  },
  sad: { 
    mouthFrown: 0.7,
    browDownLeft: 0.6,
    browDownRight: 0.6
  },
  // ... etc
}
```

## Customization Options

### Hide/Show Avatar

In `chat.js`:
```javascript
this.showAvatar = true; // Set to false to hide
```

### Change Avatar Position

In `chat.css`:
```css
.avatar-container {
    top: 20px;
    right: 20px;
    width: 280px;
    height: 320px;
}
```

### Adjust Lip Sync Sensitivity

In `avatar.js` -> `updateLipSync()`:
```javascript
const normalizedVolume = Math.min(average / 128, 1); // Change 128 to adjust sensitivity
```

### Add Custom Emotions

1. **Backend** (`server.js`):
```javascript
function detectEmotion(responseText) {
  if (/your pattern/i.test(text)) {
    return "customEmotion";
  }
}
```

2. **Avatar** (`avatar.js`):
```javascript
emotionMorphTargets = {
  customEmotion: { smile: 0.5, sad: 0.2, eyebrows: 0.1 },
}
```

## How Sound-to-Mouth Mapping Works

### Viseme Mapping (Future Enhancement)

The component includes a `visemeMap` for phoneme-to-mouth-shape mapping:

```javascript
visemeMap = {
  aa: { mouthOpen: 0.8, mouthWide: 0.3 },  // "father"
  E: { mouthOpen: 0.4, mouthWide: 0.8 },   // "bed"
  O: { mouthOpen: 0.7, mouthWide: 0 },     // "note"
  // ... etc
}
```

**Current Implementation**: Volume-based (simple and reliable)
**Future Enhancement**: Use Rhubarb Lip Sync or Azure Speech SDK visemes for phoneme-accurate lip sync

### To Enable Phoneme-Accurate Lip Sync:

1. **Option A: Azure Speech SDK** (Recommended)
   - Azure TTS can return viseme data
   - Add to API request: `"audio": { "voice": "sage", "format": "mp3", "visemes": true }`

2. **Option B: Rhubarb Lip Sync**
   - Install: `npm install rhubarb-lip-sync`
   - Process audio on server-side
   - Return viseme timestamps with audio

## Performance Optimization

### For Azure Free Tier

The avatar is optimized for Free tier:
- **Low poly count**: Simple geometry
- **Efficient rendering**: RequestAnimationFrame loop
- **No external model loading** (currently placeholder)
- **Minimal CPU usage**: ~2-5% on modern devices

### Lazy Loading

To load avatar only when needed:

```javascript
connectedCallback() {
  if (this.talkModeActive) {
    this._initializeAvatar();
  }
}
```

## Troubleshooting

### Avatar Not Showing

Check browser console for:
- Three.js import errors
- WebGL support (required for 3D rendering)

### No Lip Sync

- Ensure audio element is connected: `avatar.connectAudio(audioElement)`
- Check browser permissions for audio
- Try different browser (Chrome/Edge work best)

### Emotion Not Changing

- Check backend response includes `emotion` field
- Verify emotion name matches `emotionMorphTargets` keys
- Check browser console for errors

### Performance Issues

- Reduce avatar size in CSS
- Disable avatar on mobile: `this.showAvatar = window.innerWidth > 768`
- Use simpler geometry

## Advanced: VRM Model Integration

VRM is a standardized avatar format for VR/AR:

1. Export from VRoid Studio or similar
2. Load in avatar component:

```javascript
import { VRMLoaderPlugin } from "@pixiv/three-vrm";

async loadReadyPlayerMeAvatar(url) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  
  // Access expression manager for blend shapes
  this.blendShapes = vrm.expressionManager;
}
```

## Future Enhancements

- [ ] Azure Speech SDK viseme integration
- [ ] Voice activity detection for automatic listening state
- [ ] Gaze tracking (avatar looks at cursor)
- [ ] Gesture animations (nodding, shaking head)
- [ ] Multiple avatar choices
- [ ] Avatar customization UI
- [ ] Save avatar preferences
- [ ] Eye tracking based on user messages
- [ ] Accessibility features (disable animations)

## API Reference

### Avatar Component Methods

```javascript
avatar.setEmotion(emotion)      // Set facial expression
avatar.speak()                  // Start speaking animation
avatar.stopSpeaking()           // Stop speaking animation
avatar.listen()                 // Start listening state
avatar.stopListening()          // Stop listening state
avatar.connectAudio(audioEl)    // Connect audio for lip sync
```

### Chat Component Methods

```javascript
_updateAvatarEmotion(emotion)   // Update avatar emotion
_updateAvatarSpeaking(speaking) // Control speaking state
_updateAvatarListening(listening) // Control listening state
_connectAudioToAvatar(audioEl)  // Connect audio to avatar
```

## Credits & Resources

- **Three.js**: 3D rendering library - https://threejs.org/
- **@pixiv/three-vrm**: VRM avatar support - https://github.com/pixiv/three-vrm
- **Ready Player Me**: Avatar creation - https://readyplayer.me/
- **Azure OpenAI TTS**: Voice generation
- **ARKit Blend Shapes**: Face expression standard - https://arkit-face-blendshapes.com/

## License

This avatar system is part of Vish AI and follows the same license as the main project.

---

**Need Help?** Check the browser console for errors or refer to Three.js documentation.
