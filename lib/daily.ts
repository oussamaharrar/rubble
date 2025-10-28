import type { BubbleColor } from '@/types/game';

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DailyTuning = {
  spawn: {
    density: number;
    speedFactor: number;
  };
  colors: BubbleColor[];
  stormEvery: number;
  stormDuration: number;
};

export function getDailyKeyUTC(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function seedFromDailyKey(key: string): number {
  return hashString(`bubbleit:daily:${key}`);
}

export function deriveDailyTuning(seed: number): DailyTuning {
  const rng = createRng(seed);
  const density = 0.92 + rng() * 0.24; // between ~0.92 and 1.16
  const speedFactor = 0.95 + rng() * 0.12;
  const palette: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];
  const shuffled = [...palette];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }
  const sampleCount = 3 + Math.floor(rng() * 3);
  const colors = shuffled.slice(0, sampleCount);
  const stormEvery = Math.round(26_000 + rng() * 8_000);
  const stormDuration = Math.round(6_000 + rng() * 2_500);
  return {
    spawn: { density, speedFactor },
    colors,
    stormEvery,
    stormDuration,
  };
}

export function isDailyEligible(runCountForDay: number): boolean {
  return runCountForDay < 1;
}
