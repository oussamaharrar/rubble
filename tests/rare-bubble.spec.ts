import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/';

async function waitForStores(page: Page) {
  await page.waitForFunction(() => {
    return Boolean(
      (window as unknown as { __rubbleStore?: unknown }).__rubbleStore &&
      (window as unknown as { __rubbleRewardBoostStore?: unknown }).__rubbleRewardBoostStore
    );
  });
}

test.describe('rare and treasure bubbles', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        // ignore storage errors
      }
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await waitForStores(page);
  });

  test('rare bubble awards triple score', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      if (!store) {
        throw new Error('store not ready');
      }
      store.getState().startRun('trial');
      const baseStats = store.getState().stats;
      store.setState({
        phase: 'playing',
        width: 800,
        height: 600,
        now: 1_000,
        bubbles: [],
        recentSpawns: [],
        stats: { ...baseStats, score: 0, chainLen: 0, lastColor: undefined },
        comboWindowUntil: 0,
        currentStreak: 0,
      });
      const constant = (value: number) => () => value;
      store.setState({ rng: constant(0.02) });
      store.getState().spawnBubbles(1);
      const bubble = store.getState().bubbles.at(-1);
      if (!bubble) {
        return { kind: null, delta: 0, score: store.getState().stats.score };
      }
      const tapResult = store.getState().tap(bubble.x, bubble.y, { allowPerfect: false });
      return { kind: bubble.kind, delta: tapResult?.scoreDelta ?? 0, score: store.getState().stats.score };
    });

    expect(result.kind).toBe('rare');
    expect(result.delta).toBe(30);
    expect(result.score).toBe(30);
  });

  test('treasure bubble grants boost reward', async ({ page }) => {
    const result = await page.evaluate(() => {
      const store = (window as any).__rubbleStore;
      const rewardStore = (window as any).__rubbleRewardBoostStore;
      if (!store || !rewardStore) {
        throw new Error('stores not ready');
      }
      rewardStore.setState({ boosts: [] });
      store.getState().startRun('trial');
      const baseStats = store.getState().stats;
      store.setState({
        phase: 'playing',
        width: 800,
        height: 600,
        now: 1_000,
        bubbles: [],
        recentSpawns: [],
        stats: { ...baseStats, score: 0, chainLen: 0, lastColor: undefined },
        comboWindowUntil: 0,
        currentStreak: 0,
      });
      const constant = (value: number) => () => value;
      store.setState({ rng: constant(0) });
      store.getState().spawnBubbles(1);
      const bubble = store.getState().bubbles.at(-1);
      if (!bubble) {
        return { kind: null, delta: 0, sources: rewardStore.getState().boosts.map((item: any) => item.source) };
      }
      const tapResult = store.getState().tap(bubble.x, bubble.y, { allowPerfect: false });
      const sources = rewardStore.getState().boosts.map((item: any) => item.source);
      return { kind: bubble.kind, delta: tapResult?.scoreDelta ?? 0, sources };
    });

    expect(result.kind).toBe('treasure');
    expect(result.sources).toContain('treasure');
    expect(result.delta).toBeGreaterThanOrEqual(10);
  });
});
