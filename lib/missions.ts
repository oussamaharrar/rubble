'use client';

import { type BubbleColor, type Mission } from '@/types/game';

const COLOR_LABELS: Record<BubbleColor, string> = {
  yellow: 'yellow',
  blue: 'blue',
  green: 'green',
  pink: 'pink',
  orange: 'orange',
};

const MISSION_KEY_PREFIX = 'rubble:m:daily:';
const BONUS_KEY_PREFIX = 'rubble:m:bonus:';

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let value = seed + 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function checksumMissions(missions: Mission[]) {
  const payload = missions
    .map((mission) => `${mission.id}:${mission.progress}:${mission.completed ? 1 : 0}:${mission.claimed ? 1 : 0}`)
    .join('|');
  return hashString(payload).toString(16);
}

export function missionsStorageKey(dateKey: string) {
  return `${MISSION_KEY_PREFIX}${dateKey}`;
}

export function bonusStorageKey(dateKey: string) {
  return `${BONUS_KEY_PREFIX}${dateKey}`;
}

export function readPersistedMissions(dateKey: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(missionsStorageKey(dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { missions: Mission[]; checksum: string };
    if (!parsed || !Array.isArray(parsed.missions) || typeof parsed.checksum !== 'string') {
      return null;
    }
    const computed = checksumMissions(parsed.missions);
    if (computed !== parsed.checksum) {
      return null;
    }
    return parsed.missions;
  } catch (error) {
    console.warn("[Bubble’it!] Failed to parse missions", error);
    return null;
  }
}

export function persistMissions(dateKey: string, missions: Mission[]) {
  if (typeof window === 'undefined') return;
  const payload = {
    missions,
    checksum: checksumMissions(missions),
  };
  window.localStorage.setItem(missionsStorageKey(dateKey), JSON.stringify(payload));
}

function chooseColor(rng: () => number): BubbleColor {
  const colors: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];
  const index = Math.floor(rng() * colors.length) % colors.length;
  return colors[index];
}

export function generateDailyMissions(seed: string | number, dateKey: string): Mission[] {
  const seedNumber = typeof seed === 'number' ? seed : hashString(`${seed}-${dateKey}`);
  const rng = mulberry32(seedNumber);
  const missions: Mission[] = [];

  const color = chooseColor(rng);
  const colorTarget = 40 + Math.floor(rng() * 20);
  missions.push({
    id: `${dateKey}-color-${color}`,
    kind: 'color',
    target: colorTarget,
    progress: 0,
    label: `Pop ${colorTarget} ${COLOR_LABELS[color]} bubbles`,
    rewardOrbs: 1,
    completed: false,
    claimed: false,
  });

  const comboTarget = 6 + Math.floor(rng() * 6);
  missions.push({
    id: `${dateKey}-combo-${comboTarget}`,
    kind: 'combo',
    target: comboTarget,
    progress: 0,
    label: `Achieve Combo ×${comboTarget}`,
    rewardOrbs: 1,
    completed: false,
    claimed: false,
  });

  const survivalTarget = 90 + Math.floor(rng() * 60);
  missions.push({
    id: `${dateKey}-survival-${survivalTarget}`,
    kind: 'survival',
    target: survivalTarget,
    progress: 0,
    label: `Survive ${survivalTarget} seconds`,
    rewardOrbs: 1,
    completed: false,
    claimed: false,
  });

  return missions;
}
