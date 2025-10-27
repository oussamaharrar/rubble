'use client';

import Image from 'next/image';
import clsx from 'clsx';
import PayButton from '@/components/PayButton';
import { useEconomyStore } from '@/lib/economy-store';
import { formatPriceLabel, getPriceWei } from '@/lib/pricing';

type GrantHandler = (
  grantBoost: (n: number) => void,
  addBubbles: (n: number) => void,
  grantRetry: (n: number) => void
) => void;

const SHOP_ITEMS: Array<{
  id: 'boost' | 'combo' | 'retry';
  title: string;
  description: string;
  sku: string;
  icon: string;
  grant: GrantHandler;
}> = [
  {
    id: 'boost',
    title: 'Boost Charge',
    description: 'Instant slow-time boost to stabilise combos.',
    sku: 'rubble_boost_micro',
    icon: '/game-icons/booster-freeze.png',
    grant: (grantBoost) => {
      grantBoost(1);
    },
  },
  {
    id: 'combo',
    title: 'Combo Kickstart',
    description: 'Begin your next run with +5 combo momentum.',
    sku: 'rubble_combo_plus',
    icon: '/game-icons/booster-double.png',
    grant: (grantBoost, addBubbles) => {
      grantBoost(1);
      addBubbles(10);
    },
  },
  {
    id: 'retry',
    title: 'Retry Life',
    description: 'One more chance when storms overwhelm you.',
    sku: 'rubble_retry_token',
    icon: '/game-icons/booster-magnet.png',
    grant: (_grantBoost, _addBubbles, grantRetry) => {
      grantRetry(1);
    },
  },
];

type ShopPanelProps = {
  className?: string;
  onPurchase?: (itemId: string) => void;
};

export default function ShopPanel({ className, onPurchase }: ShopPanelProps) {
  const boosts = useEconomyStore((state) => state.boosts);
  const retries = useEconomyStore((state) => state.retries);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const grantRetry = useEconomyStore((state) => state.grantRetry);
  const addBubbles = useEconomyStore((state) => state.addBubbles);

  return (
    <section className={clsx('space-y-4', className)}>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300/70">Storefront</p>
          <h2 className="text-lg font-semibold text-slate-50">Base Boost Bazaar</h2>
        </div>
        <div className="text-right text-xs text-slate-300/70">
          <p>Boosts: <span className="font-semibold text-sky-200">{boosts}</span></p>
          <p>Bubbles: <span className="font-semibold text-amber-200">{bubbles}</span></p>
          <p>Retries: <span className="font-semibold text-rose-200">{retries}</span></p>
        </div>
      </header>
      <div className="space-y-3">
        {SHOP_ITEMS.map((item) => {
          const priceWei = getPriceWei(item.id);
          const priceLabel = formatPriceLabel(item.id);
          const handleGrant = () => {
            item.grant(grantBoost, addBubbles, grantRetry);
            onPurchase?.(item.id);
          };
          return (
            <div
              key={item.id}
              className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_20px_50px_rgba(14,165,233,0.12)]"
            >
              <div className="flex items-center gap-4">
                <Image src={item.icon} alt={item.title} width={52} height={52} className="rounded-full bg-slate-950/70 p-2" />
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-50">{item.title}</h3>
                  <p className="text-xs text-slate-300/80">{item.description}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-200">{priceLabel}</p>
                </div>
              </div>
              <div className="mt-3 max-w-xs">
                <PayButton
                  sku={item.sku}
                  amountWei={priceWei}
                  label={`Buy ${item.title}`}
                  onGranted={handleGrant}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
