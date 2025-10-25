import { BoosterConfig } from './types';

const MIN_PRICE = (() => {
  try {
    return BigInt(process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '0');
  } catch {
    return 0n;
  }
})();

function withMultiplier(base: bigint, multiplier: number) {
  const scaled = BigInt(Math.round(multiplier * 1_000));
  return (base * scaled) / 1_000n;
}

function baseline(multiplier: number) {
  if (MIN_PRICE === 0n) {
    const base = 10_000_000_000_000n; // fallback micro price
    return withMultiplier(base, multiplier);
  }
  return withMultiplier(MIN_PRICE, multiplier);
}

export const BOOSTERS: BoosterConfig[] = [
  {
    sku: 'booster_time_freeze',
    label: 'Time Freeze',
    type: 'time-freeze',
    durationMs: 5000,
    description: 'Slows the cosmos for 5s. Glide through frozen bubbles.',
    priceWei: baseline(1),
    icon: '/game-icons/booster-freeze.png',
  },
  {
    sku: 'booster_score_doubler',
    label: 'Score Doubler',
    type: 'score-doubler',
    durationMs: 10000,
    description: '10 seconds of double points. Stack it with combos!',
    priceWei: baseline(MIN_PRICE === 0n ? 1.5 : 2),
    icon: '/game-icons/booster-double.png',
  },
  {
    sku: 'booster_bubble_magnet',
    label: 'Bubble Magnet',
    type: 'bubble-magnet',
    durationMs: 6000,
    description: 'Orbits capture nearby bubbles for 6s.',
    priceWei: baseline(MIN_PRICE === 0n ? 1.2 : 1.5),
    icon: '/game-icons/booster-magnet.png',
  },
];
