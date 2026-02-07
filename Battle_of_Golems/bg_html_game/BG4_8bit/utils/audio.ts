
// Audio synthesis utility for retro sound effects using Web Audio API

let audioCtx: AudioContext | null = null;
let isGlobalMuted = false;

export const setGlobalMute = (muted: boolean) => {
  isGlobalMuted = muted;
  if (audioCtx) {
    if (muted) {
      audioCtx.suspend();
    } else {
      audioCtx.resume();
    }
  }
};

const getContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

// Simple oscillator helper
const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
  if (isGlobalMuted) return;
  const ctx = getContext();
  if (ctx.state === 'suspended' && !isGlobalMuted) ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
};

// Noise buffer for explosions/hits
const createNoiseBuffer = (ctx: AudioContext) => {
  const bufferSize = ctx.sampleRate * 2; // 2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

let noiseBuffer: AudioBuffer | null = null;

const playNoise = (duration: number, vol = 0.1) => {
  if (isGlobalMuted) return;
  const ctx = getContext();
  if (ctx.state === 'suspended' && !isGlobalMuted) ctx.resume();
  
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer(ctx);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  
  // Lowpass filter for "thud" or "explosion" feel
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(100, ctx.currentTime + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  src.start();
  src.stop(ctx.currentTime + duration);
};

export const SoundEffects = {
  move: () => {
    // Short high pitched blip
    playTone(150, 'square', 0.05, 0.05);
    setTimeout(() => playTone(200, 'square', 0.05, 0.05), 50);
  },
  turn: () => {
    playTone(120, 'triangle', 0.1, 0.05);
  },
  attack: () => {
    // "Whoosh" noise
    playNoise(0.15, 0.2);
  },
  hitRobot: () => {
    // Crunch sound
    playNoise(0.3, 0.3);
    playTone(100, 'sawtooth', 0.2, 0.2);
  },
  hitWall: () => {
    // Low thud
    playTone(80, 'square', 0.1, 0.2);
  },
  hitShield: () => {
    // High metallic ping
    playTone(800, 'sine', 0.2, 0.1);
    playTone(1200, 'sine', 0.1, 0.05);
  },
  destroyBarrel: () => {
    // Wood breaking / crumbling noise
    playNoise(0.4, 0.25);
  },
  splash: () => {
    // Water splash - filtered noise + sliding pitch
    playNoise(0.4, 0.2);
    // ... we rely mostly on the noise filter ramp for this
  },
  explode: () => {
    playNoise(0.8, 0.5);
    playTone(50, 'sawtooth', 0.8, 0.4);
  },
  uiClick: () => {
    playTone(400, 'sine', 0.05, 0.05);
  },
  uiStart: () => {
    playTone(440, 'square', 0.1, 0.1);
    setTimeout(() => playTone(554, 'square', 0.1, 0.1), 100);
    setTimeout(() => playTone(659, 'square', 0.2, 0.1), 200);
  }
};
