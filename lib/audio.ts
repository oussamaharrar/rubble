'use client';

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch (error) {
      console.warn('[Rubble] Failed to create audio context', error);
      audioContext = null;
    }
  }
  return audioContext;
}

export type TapChimeOptions = {
  perfect?: boolean;
  pitch?: number;
};

function scheduleTone(ctx: AudioContext, frequency: number, duration: number, delay: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = 0;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime + delay;
  const attack = 0.01;
  const release = Math.max(0.08, duration - attack);
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release);

  oscillator.start(now);
  oscillator.stop(now + attack + release + 0.02);
}

export function playTapChime(options: TapChimeOptions = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  const base = options.pitch ?? 620;
  const jitter = (Math.random() - 0.5) * 12;
  const primary = base + jitter;
  scheduleTone(ctx, primary, options.perfect ? 0.24 : 0.18, 0);
  if (options.perfect) {
    scheduleTone(ctx, primary * 1.26, 0.2, 0.04);
  }
}
