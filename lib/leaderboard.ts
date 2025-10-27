import { BoardKind } from '@/types/game';

const STORAGE_PREFIX = 'rubble:leaderboard';

export type LeaderboardEntry = {
  score: number;
  combo: number;
  streak: number;
  date: string;
  dailyKey?: string;
  entryMode?: string;
};

export type SaveScoreInput = LeaderboardEntry & { board: BoardKind };

function storageKey(board: BoardKind) {
  return `${STORAGE_PREFIX}:${board}`;
}

function readBoard(board: BoardKind): LeaderboardEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey(board));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.score === 'number' &&
          typeof entry.combo === 'number' &&
          typeof entry.streak === 'number' &&
          typeof entry.date === 'string'
      )
      .slice(0, 10);
  } catch (error) {
    console.warn("[Bubble’it!] Failed to read leaderboard", error);
    return [];
  }
}

function writeBoard(board: BoardKind, entries: LeaderboardEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(board), JSON.stringify(entries.slice(0, 10)));
  } catch (error) {
    console.warn("[Bubble’it!] Failed to persist leaderboard", error);
  }
}

export function saveScore(input: SaveScoreInput) {
  const { board, ...entry } = input;
  const existing = readBoard(board);
  const next = [...existing, entry];
  next.sort((a, b) => b.score - a.score || b.combo - a.combo || b.streak - a.streak);
  writeBoard(board, next.slice(0, 10));
  return next.slice(0, 10);
}

export function getBoard(board: BoardKind): LeaderboardEntry[] {
  return readBoard(board);
}

export function shareUrl({
  score,
  board,
  dailyKey,
}: {
  score: number;
  board: BoardKind;
  dailyKey?: string;
}): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('score', `${score}`);
    url.searchParams.set('board', board);
    if (dailyKey) {
      url.searchParams.set('daily', dailyKey);
    }
    return url.toString();
  } catch {
    return '';
  }
}
