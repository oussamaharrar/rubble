'use client';

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return null;
  }
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {
      /* noop */
    });
  }
  return audioContext;
}

interface TapChimeOptions {
  perfect?: boolean;
  pitch?: number;
  rare?: boolean;
}

function envelope(gain: GainNode, start: number, attack: number, peak: number, decay: number, sustain: number) {
  gain.gain.cancelScheduledValues(start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), start + attack + decay);
}

export function playTapChime(options: TapChimeOptions = {}) {
  const context = getContext();
  if (!context) return;

  const perfect = options.perfect === true;
  const rare = options.rare === true;
  const randomSpread = perfect ? 28 : 36;
  const baseFrequency = options.pitch ?? (rare ? 880 : perfect ? 720 : 520);
  const detuneCents = (Math.random() - 0.5) * randomSpread;
  const frequency = baseFrequency * Math.pow(2, detuneCents / 1200);
  const now = context.currentTime;

  const gain = context.createGain();
  const peak = rare ? 0.22 : 0.18;
  const sustain = rare ? 0.0008 : 0.0004;
  envelope(gain, now, 0.012, peak, perfect ? 0.22 : 0.18, sustain);

  const primary = context.createOscillator();
  primary.type = perfect ? 'triangle' : 'sine';
  primary.frequency.setValueAtTime(frequency, now);
  primary.connect(gain);

  const detuned = context.createOscillator();
  detuned.type = rare ? 'triangle' : perfect ? 'square' : 'sine';
  detuned.frequency.setValueAtTime(frequency * (rare ? 1.35 : 0.72), now);
  detuned.detune.setValueAtTime(rare ? 40 : -15, now);
  detuned.connect(gain);

  gain.connect(context.destination);

  primary.start(now);
  primary.stop(now + (perfect ? 0.45 : rare ? 0.5 : 0.28));
  detuned.start(now + 0.03);
  detuned.stop(now + (perfect ? 0.44 : rare ? 0.46 : 0.25));

  const noiseBuffer = context.createBuffer(1, context.sampleRate * 0.2, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (rare ? 0.35 : 0.25);
  }
  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = context.createGain();
  envelope(noiseGain, now, 0.01, rare ? 0.3 : 0.2, 0.18, 0.0001);
  noise.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(now);
  noise.stop(now + 0.22);
}

export function playUiWhoosh() {
  const context = getContext();
  if (!context) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(460, now + 0.24);
  const gain = context.createGain();
  envelope(gain, now, 0.02, 0.18, 0.18, 0.0001);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

export function playBubbleBounce() {
  const context = getContext();
  if (!context) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
  const gain = context.createGain();
  envelope(gain, now, 0.01, 0.22, 0.12, 0.0004);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}
