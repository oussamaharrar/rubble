'use client';

import PayButton from '@/components/PayButton';
import { formatWei, getPriceWei, getUsdHint } from '@/lib/pricing';
import { useEconomyStore } from '@/lib/economy-store';

interface ShopPanelProps {
  onClose?: () => void;
}

type ShopActions = {
  grantBoost: (n: number) => void;
  addBubbles: (n: number) => void;
  grantDouble: (n: number) => void;
  grantRetry: (n: number) => void;
};

const SHOP_ITEMS = [
  {
    id: 'boost',
    title: 'Boost',
    description: 'Freeze time for 5 seconds to rescue your combo.',
    sku: 'boost_time',
    grant: ({ grantBoost }: ShopActions) => grantBoost(1),
  },
  {
    id: 'combo',
    title: 'Extra Combo',
    description: 'Start each run with a +5 combo streak.',
    sku: 'combo_plus',
    grant: ({ grantDouble }: ShopActions) => {
      grantDouble(1);
    },
  },
  {
    id: 'retry',
    title: 'Retry',
    description: 'Earn an extra life to continue after a wipeout.',
    sku: 'retry_token',
    grant: ({ grantRetry }: ShopActions) => {
      grantRetry(1);
    },
  },
] as const;

export default function ShopPanel({ onClose }: ShopPanelProps) {
  const boosts = useEconomyStore((state) => state.boosts);
  const retries = useEconomyStore((state) => state.retries);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const addBubbles = useEconomyStore((state) => state.addBubbles);
  const grantDouble = useEconomyStore((state) => state.grantDoubleScoreGames);
  const grantRetry = useEconomyStore((state) => state.grantRetry);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Base Shop</h2>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Micro-boosts for the next run</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200"
          >
            Close
          </button>
        ) : null}
      </header>

      <section className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        <span className="rounded-full border border-sky-500/30 bg-sky-500/20 px-3 py-1 text-sky-100">Boosts {boosts}</span>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-amber-100">Retries {retries}</span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-emerald-100">Bubbles {bubbles}</span>
      </section>

      <div className="space-y-4">
        {SHOP_ITEMS.map((item) => {
          const priceWei = getPriceWei(item.id as 'boost' | 'combo' | 'retry');
          const usdHint = getUsdHint(item.id as 'boost' | 'combo' | 'retry');
          const label = `${item.title} · ${usdHint}`;
          return (
            <div
              key={item.id}
              className="rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.4)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-300">{item.description}</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {formatWei(priceWei)} · {usdHint}
                  </p>
                </div>
                <div className="min-w-[160px]">
                  <PayButton
                    sku={`shop_${item.sku}`}
                    amountWei={priceWei}
                    label={label}
                    onGranted={() =>
                      item.grant({
                        grantBoost,
                        addBubbles,
                        grantDouble,
                        grantRetry,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
