'use client';

import { create } from 'zustand';

export type AppScreen =
  | 'HOME'
  | 'PLAYING'
  | 'PAUSED'
  | 'SETTINGS'
  | 'HOW_TO_PLAY'
  | 'SCOREBOARD';

interface AppScreenState {
  screen: AppScreen;
  previous: AppScreen | null;
  setScreen: (next: AppScreen) => void;
  canTransition: (next: AppScreen) => boolean;
}

const allowed: Record<AppScreen, AppScreen[]> = {
  HOME: ['PLAYING', 'SETTINGS', 'HOW_TO_PLAY', 'SCOREBOARD'],
  PLAYING: ['PAUSED'],
  PAUSED: ['PLAYING', 'HOME'],
  SETTINGS: ['HOME'],
  HOW_TO_PLAY: ['HOME'],
  SCOREBOARD: ['HOME'],
};

export const useAppScreenStore = create<AppScreenState>((set, get) => ({
  screen: 'HOME',
  previous: null,
  canTransition: (next) => {
    const current = get().screen;
    const allowedTargets = allowed[current] ?? [];
    return allowedTargets.includes(next);
  },
  setScreen: (next) => {
    const current = get().screen;
    if (current === next) return;
    const allowedTargets = allowed[current] ?? [];
    if (!allowedTargets.includes(next)) {
      if (next === 'HOME' && current !== 'HOME') {
        set({ previous: current, screen: 'HOME' });
      }
      return;
    }
    set({ previous: current, screen: next });
  },
}));

export function resetScreens() {
  useAppScreenStore.setState({ screen: 'HOME', previous: null });
}
