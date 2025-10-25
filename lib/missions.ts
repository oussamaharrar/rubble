import { Mission, BubbleColor } from '@/types/game';

const COLOR_LABELS: Record<BubbleColor, string> = {
  yellow: 'yellow',
  blue: 'blue',
  green: 'green',
  pink: 'pink',
  orange: 'orange',
};

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string | number) {
  if (typeof value === 'number') return value;
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

export function generateDailyMissions(seed: string | number, dateKey: string): Mission[] {
  const rng = mulberry32(hashSeed(`${seed}-${dateKey}`));
  const colors: BubbleColor[] = ['yellow', 'blue', 'green', 'pink', 'orange'];

  const color = colors[Math.floor(rng() * colors.length)];
  const targetColor = 40 + Math.floor(rng() * 20);

  const comboTarget = 6 + Math.floor(rng() * 6);
  const survivalTarget = 90 + Math.floor(rng() * 60);

  const missions: Mission[] = [
    {
      id: `${dateKey}-color`,
      kind: 'color',
      target: targetColor,
      progress: 0,
      label: `Pop ${targetColor} ${COLOR_LABELS[color]} bubbles`,
      rewardOrbs: 1,
      completed: false,
      claimed: false,
      color,
    },
    {
      id: `${dateKey}-combo`,
      kind: 'combo',
      target: comboTarget,
      progress: 0,
      label: `Achieve Combo ×${comboTarget}`,
      rewardOrbs: 1,
      completed: false,
      claimed: false,
    },
    {
      id: `${dateKey}-survival`,
      kind: 'survival',
      target: survivalTarget,
      progress: 0,
      label: `Survive ${survivalTarget}s in Rubble Rush`,
      rewardOrbs: 1,
      completed: false,
      claimed: false,
    },
  ];

  return missions;
}

export function progressColor(mission: Mission, color?: BubbleColor) {
  if (mission.kind !== 'color' || mission.completed) return mission;
  if (!color || (mission.color && mission.color !== color)) return mission;
  const progress = Math.min(mission.target, mission.progress + 1);
  if (progress === mission.progress) return mission;
  const completed = progress >= mission.target;
  return { ...mission, progress, completed };
}

export function progressCombo(mission: Mission, combo: number) {
  if (mission.kind !== 'combo' || mission.completed) return mission;
  const progress = Math.max(mission.progress, combo);
  if (progress === mission.progress) return mission;
  return { ...mission, progress, completed: progress >= mission.target };
}

export function progressSurvival(mission: Mission, seconds: number) {
  if (mission.kind !== 'survival' || mission.completed) return mission;
  const progress = Math.min(mission.target, mission.progress + seconds);
  if (progress === mission.progress) return mission;
  return { ...mission, progress, completed: progress >= mission.target };
}

export function claimMission(mission: Mission): Mission {
  if (!mission.completed || mission.claimed) return mission;
  return { ...mission, claimed: true };
}
