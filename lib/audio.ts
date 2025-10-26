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
}

export function playTapChime(options: TapChimeOptions = {}) {
  const context = getContext();
  if (!context) return;

  const perfect = options.perfect === true;
  const baseFrequency = options.pitch ?? (perfect ? 720 : 520);
  const detuneCents = (Math.random() - 0.5) * 20;
  const frequency = baseFrequency * Math.pow(2, detuneCents / 1200);
  const now = context.currentTime;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (perfect ? 0.42 : 0.28));

  const primary = context.createOscillator();
  primary.type = perfect ? 'triangle' : 'sine';
  primary.frequency.setValueAtTime(frequency, now);
  primary.connect(gain);

  let secondary: OscillatorNode | null = null;
  if (perfect) {
    secondary = context.createOscillator();
    secondary.type = 'sine';
    secondary.frequency.setValueAtTime(frequency * 1.5, now);
    secondary.connect(gain);
  }

  gain.connect(context.destination);

  primary.start(now);
  primary.stop(now + (perfect ? 0.45 : 0.3));
  if (secondary) {
    secondary.start(now + 0.05);
    secondary.stop(now + 0.48);
  }
}
