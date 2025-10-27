'use client';

import { create } from 'zustand';
import { useGameStore } from '@/lib/store';

export type AppScreen =
  | 'HOME'
  | 'PLAYING'
  | 'PAUSED'
  | 'SETTINGS'
  | 'HOW_TO_PLAY'
  | 'SCOREBOARD';

type ScreenStore = {
  screen: AppScreen;
  previous: AppScreen | null;
  startGame: (options?: { board?: 'normal' | 'daily'; entryMode?: 'trial' | 'paid' }) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  goHome: () => void;
  openSettings: () => void;
  openHowToPlay: () => void;
  openScoreboard: () => void;
};

function beginGameplaySoon() {
  if (typeof window === 'undefined') {
    useGameStore.getState().beginGameplay();
    return;
  }
  window.requestAnimationFrame(() => {
    const { beginGameplay } = useGameStore.getState();
    beginGameplay();
  });
}

export const useScreenStore = create<ScreenStore>((set, get) => ({
  screen: 'HOME',
  previous: null,
  startGame: (options) => {
    const current = get().screen;
    if (current !== 'HOME') {
      return;
    }
    const board = options?.board ?? 'normal';
    const entryMode = options?.entryMode ?? 'trial';
    const game = useGameStore.getState();
    game.setBoardKind(board === 'daily' ? 'daily' : 'normal');
    game.startRun(entryMode);
    beginGameplaySoon();
    set({ previous: current, screen: 'PLAYING' });
  },
  pauseGame: () => {
    const current = get().screen;
    if (current !== 'PLAYING') {
      return;
    }
    useGameStore.getState().pauseRun();
    set({ previous: current, screen: 'PAUSED' });
  },
  resumeGame: () => {
    const current = get().screen;
    if (current !== 'PAUSED') {
      return;
    }
    useGameStore.getState().resumeRun();
    set({ previous: current, screen: 'PLAYING' });
  },
  goHome: () => {
    const current = get().screen;
    if (current === 'HOME') {
      return;
    }
    if (current === 'PLAYING' || current === 'PAUSED') {
      useGameStore.getState().resetToStart();
    }
    set({ previous: current, screen: 'HOME' });
  },
  openSettings: () => {
    const current = get().screen;
    if (current !== 'HOME') {
      return;
    }
    set({ previous: current, screen: 'SETTINGS' });
  },
  openHowToPlay: () => {
    const current = get().screen;
    if (current !== 'HOME') {
      return;
    }
    set({ previous: current, screen: 'HOW_TO_PLAY' });
  },
  openScoreboard: () => {
    const current = get().screen;
    if (current !== 'HOME') {
      return;
    }
    set({ previous: current, screen: 'SCOREBOARD' });
  },
}));
