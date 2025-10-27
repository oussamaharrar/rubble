import { create } from 'zustand';

export type AppScreen =
  | 'HOME'
  | 'PLAYING'
  | 'PAUSED'
  | 'SETTINGS'
  | 'HOW_TO_PLAY'
  | 'SCOREBOARD';

type AllowedMap = Record<AppScreen, AppScreen[]>;

const ALLOWED: AllowedMap = {
  HOME: ['PLAYING', 'SETTINGS', 'HOW_TO_PLAY', 'SCOREBOARD'],
  PLAYING: ['PAUSED', 'HOME'],
  PAUSED: ['PLAYING', 'HOME'],
  SETTINGS: ['HOME'],
  HOW_TO_PLAY: ['HOME'],
  SCOREBOARD: ['HOME'],
};

function canTransition(current: AppScreen, next: AppScreen) {
  if (current === next) return true;
  const allowed = ALLOWED[current];
  return allowed ? allowed.includes(next) : false;
}

interface ScreenState {
  current: AppScreen;
  previous: AppScreen | null;
  transition: (screen: AppScreen) => void;
  goHome: () => void;
  startPlaying: () => void;
  pause: () => void;
  resume: () => void;
  openSettings: () => void;
  openHowTo: () => void;
  openScoreboard: () => void;
}

export const useScreenStore = create<ScreenState>((set, get) => ({
  current: 'HOME',
  previous: null,
  transition: (screen) => {
    const { current } = get();
    if (!canTransition(current, screen)) {
      return;
    }
    if (current === screen) return;
    set({ current: screen, previous: current });
  },
  goHome: () => {
    const { current } = get();
    if (current === 'HOME') return;
    if (canTransition(current, 'HOME')) {
      set({ current: 'HOME', previous: current });
    }
  },
  startPlaying: () => {
    const { current } = get();
    if (current === 'PLAYING') return;
    if (canTransition(current, 'PLAYING')) {
      set({ current: 'PLAYING', previous: current });
    }
  },
  pause: () => {
    const { current } = get();
    if (current === 'PAUSED') return;
    if (canTransition(current, 'PAUSED')) {
      set({ current: 'PAUSED', previous: current });
    }
  },
  resume: () => {
    const { current } = get();
    if (current === 'PLAYING') return;
    if (canTransition(current, 'PLAYING')) {
      set({ current: 'PLAYING', previous: current });
    }
  },
  openSettings: () => {
    const { current } = get();
    if (current === 'SETTINGS') return;
    if (canTransition(current, 'SETTINGS')) {
      set({ current: 'SETTINGS', previous: current });
    }
  },
  openHowTo: () => {
    const { current } = get();
    if (current === 'HOW_TO_PLAY') return;
    if (canTransition(current, 'HOW_TO_PLAY')) {
      set({ current: 'HOW_TO_PLAY', previous: current });
    }
  },
  openScoreboard: () => {
    const { current } = get();
    if (current === 'SCOREBOARD') return;
    if (canTransition(current, 'SCOREBOARD')) {
      set({ current: 'SCOREBOARD', previous: current });
    }
  },
}));
