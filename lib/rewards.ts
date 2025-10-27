export type RewardGrant =
  | { kind: 'boost'; amount: number }
  | { kind: 'bubbles'; amount: number }
  | { kind: 'double' }
  | { kind: 'skin'; id: string }
  | { kind: 'sticker'; id: string };

export type DailyRewardDefinition = {
  day: number;
  label: string;
  description: string;
  grant: RewardGrant | { kind: 'wheel' };
};

const SKIN_ID = 'special-balloon-aurora';
const STICKER_ID = 'sticker-rubble-star';

export function getDailyRewardForDay(day: number): DailyRewardDefinition {
  if (day <= 1) {
    return {
      day,
      label: 'Boost Burst',
      description: '1 complimentary boost for your next run.',
      grant: { kind: 'boost', amount: 1 },
    };
  }
  if (day === 2) {
    return {
      day,
      label: 'Bubble Bank',
      description: '+50 soft Bubbles for cosmetic unlocks.',
      grant: { kind: 'bubbles', amount: 50 },
    };
  }
  if (day === 3) {
    return {
      day,
      label: 'Double Score Ready',
      description: 'Activate double score for one full game.',
      grant: { kind: 'double' },
    };
  }
  if (day === 4) {
    return {
      day,
      label: 'Aurora Balloon Skin',
      description: 'Equip a shimmering balloon trail in-game.',
      grant: { kind: 'skin', id: SKIN_ID },
    };
  }
  if (day === 5) {
    return {
      day,
      label: 'Rubble Crown Sticker',
      description: 'Collectible sticker unlocked for your profile.',
      grant: { kind: 'sticker', id: STICKER_ID },
    };
  }
  if (day === 6) {
    return {
      day,
      label: 'Bonus Boost',
      description: 'Extra boost stockpile to prep for streak 7.',
      grant: { kind: 'boost', amount: 1 },
    };
  }
  return {
    day,
    label: 'Wheel Spin',
    description: 'Spin for a surprise prize. Luck favours long streaks!',
    grant: { kind: 'wheel' },
  };
}

export function spinWheel(random = Math.random): RewardGrant {
  const prizes: RewardGrant[] = [
    { kind: 'boost', amount: 1 },
    { kind: 'boost', amount: 2 },
    { kind: 'bubbles', amount: 75 },
    { kind: 'bubbles', amount: 120 },
    { kind: 'double' },
    { kind: 'sticker', id: `${STICKER_ID}-alt` },
  ];
  const index = Math.floor(random() * prizes.length) % prizes.length;
  return prizes[index];
}

export function rewardToText(grant: RewardGrant): string {
  switch (grant.kind) {
    case 'boost':
      return grant.amount === 1 ? '1 Boost added' : `${grant.amount} Boosts added`;
    case 'bubbles':
      return `+${grant.amount} Bubbles banked`;
    case 'double':
      return 'Double Score activated for the next game';
    case 'skin':
      return 'New balloon skin unlocked';
    case 'sticker':
      return 'Sticker added to your collection';
    default:
      return 'Reward granted';
  }
}
