import type { BubbleColor, Mission } from '@/types/game';

const COLORS: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string | number, dateKey: string) {
  const input = `${dateKey}:${seed}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function generateDailyMissions(seed: string | number, dateKey: string): Mission[] {
  const rng = mulberry32(hashSeed(seed, dateKey));
  const colorIndex = Math.floor(rng() * COLORS.length) % COLORS.length;
  const color = COLORS[colorIndex];
  const colorTarget = 50;
  const comboTarget = 10;
  const survivalTarget = 120;

  const missions: Mission[] = [
    {
      id: `color-${color}`,
      kind: 'color',
      target: colorTarget,
      progress: 0,
      label: `Pop ${colorTarget} ${color} bubbles`,
      rewardOrbs: 1,
      completed: false,
      claimed: false,
    },
    {
      id: `combo-${comboTarget}`,
      kind: 'combo',
      target: comboTarget,
      progress: 0,
      label: `Achieve Combo ×${comboTarget}`,
      rewardOrbs: 1,
      completed: false,
      claimed: false,
    },
    {
      id: `survival-${survivalTarget}`,
      kind: 'survival',
      target: survivalTarget,
      progress: 0,
      label: `Survive ${survivalTarget} seconds`,
      rewardOrbs: 1,
      completed: false,
      claimed: false,
    },
  ];

  return missions;
}

function clampProgress(progress: number, target: number) {
  return progress >= target ? target : progress;
}

export function progressColor(missions: Mission[], color: BubbleColor, amount = 1): Mission[] {
  return missions.map((mission) => {
    if (mission.kind !== 'color') return mission;
    const missionColor = mission.id.split('-')[1];
    if (missionColor !== color) return mission;
    const nextProgress = clampProgress(mission.progress + amount, mission.target);
    return {
      ...mission,
      progress: nextProgress,
      completed: nextProgress >= mission.target,
    };
  });
}

export function progressCombo(missions: Mission[], combo: number): Mission[] {
  return missions.map((mission) => {
    if (mission.kind !== 'combo') return mission;
    const nextProgress = clampProgress(Math.max(mission.progress, combo), mission.target);
    return {
      ...mission,
      progress: nextProgress,
      completed: nextProgress >= mission.target,
    };
  });
}

export function progressSurvival(missions: Mission[], seconds: number): Mission[] {
  return missions.map((mission) => {
    if (mission.kind !== 'survival') return mission;
    const nextProgress = clampProgress(mission.progress + seconds, mission.target);
    return {
      ...mission,
      progress: nextProgress,
      completed: nextProgress >= mission.target,
    };
  });
}

export function claimMission(missions: Mission[], id: string): Mission[] {
  return missions.map((mission) => {
    if (mission.id !== id) return mission;
    if (!mission.completed || mission.claimed) return mission;
    return {
      ...mission,
      claimed: true,
    };
  });
}
