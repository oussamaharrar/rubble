import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { previewDailyReward, useEconomyStore } from '@/lib/economy-store';

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

const initialState = (() => {
  const snapshot = useEconomyStore.getState();
  return {
    ...snapshot,
    skins: [...snapshot.skins],
    stickers: [...snapshot.stickers],
  };
})();

let storage: MemoryStorage;

function resetStore() {
  useEconomyStore.setState(
    {
      ...initialState,
      address: undefined,
      bubbles: 0,
      boosts: 0,
      retries: 0,
      skins: [],
      stickers: [],
      trialUsedToday: false,
      streak: 0,
      lastLogin: undefined,
      todayRewardClaimed: false,
      shareRewardedToday: false,
      doubleScoreGames: 0,
      inviteCount: 0,
    },
    true,
  );
}

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as any).window = { localStorage: storage };
  (globalThis as any).localStorage = storage;
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
  resetStore();
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});

describe('useEconomyStore.connect', () => {
  it('grants a one-time boost on first wallet connection', () => {
    const store = useEconomyStore.getState();
    expect(store.boosts).toBe(0);

    store.connect('0xAbCd');
    expect(useEconomyStore.getState().boosts).toBe(1);

    store.connect('0xAbCd');
    expect(useEconomyStore.getState().boosts).toBe(1);
  });
});

describe('useEconomyStore.claimDailyReward', () => {
  it('awards sequential streak rewards across consecutive days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T09:00:00Z'));

    const first = useEconomyStore.getState().claimDailyReward();
    expect(first).not.toBeNull();
    expect(first!.streak).toBe(1);
    expect(first!.reward.kind).toBe('boost');
    expect(useEconomyStore.getState().boosts).toBe(1);

    vi.setSystemTime(new Date('2025-01-02T09:00:00Z'));
    useEconomyStore.getState().hydrate();
    const second = useEconomyStore.getState().claimDailyReward();
    expect(second).not.toBeNull();
    expect(second!.streak).toBe(2);
    expect(second!.reward).toMatchObject({ kind: 'bubbles', amount: 50 });
    expect(useEconomyStore.getState().bubbles).toBe(50);
  });

  it('resets the streak if a day is missed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-01T09:00:00Z'));
    useEconomyStore.getState().claimDailyReward();

    vi.setSystemTime(new Date('2025-02-03T09:00:00Z'));
    useEconomyStore.getState().hydrate();
    const reward = useEconomyStore.getState().claimDailyReward();

    expect(reward).not.toBeNull();
    expect(reward!.streak).toBe(1);
    expect(reward!.reward.kind).toBe('boost');
  });
});

describe('useEconomyStore.recordShareToday', () => {
  it('only grants a boost once per day for sharing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-10T00:00:00Z'));

    const granted = useEconomyStore.getState().recordShareToday();
    expect(granted).toBe(true);
    expect(useEconomyStore.getState().boosts).toBe(1);

    const second = useEconomyStore.getState().recordShareToday();
    expect(second).toBe(false);
    expect(useEconomyStore.getState().boosts).toBe(1);
  });
});

describe('previewDailyReward', () => {
  it('predicts the next reward based on streak and last login', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-05T12:00:00Z'));

    const reward = previewDailyReward(3, '2025-04-05');
    expect(reward.kind).toBe('double-score');
    expect(reward.amount).toBe(1);
  });
});
