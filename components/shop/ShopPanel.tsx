'use client';

import { motion } from 'framer-motion';
import PayButton from '@/components/PayButton';
import { SHOP_ITEMS } from '@/lib/pricing';
import { useEconomyStore } from '@/lib/economy-store';

export default function ShopPanel() {
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const addCombo = useEconomyStore((state) => state.addComboStart);
  const grantRetry = useEconomyStore((state) => state.grantRetry);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/15 bg-slate-900/70 p-5 shadow-inner shadow-black/30">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shop</p>
        <h2 className="text-lg font-semibold text-white">Boost your run</h2>
      </div>
      <div className="space-y-4">
        {SHOP_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-slate-300">{item.description}</p>
              </div>
              <span className="rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
                {item.usdLabel}
              </span>
            </div>
            <PayButton
              sku={`shop_${item.id}`}
              amountWei={item.priceWei}
              label={`Buy ${item.label}`}
              grantBooster={false}
              onGranted={() => {
                if (item.id === 'boost') {
                  grantBoost(1);
                } else if (item.id === 'combo') {
                  addCombo(5);
                } else if (item.id === 'retry') {
                  grantRetry(1);
                }
              }}
            />
          </div>
        ))}
      </div>
      <motion.p className="text-xs text-slate-400">
        Purchases are handled on Base mainnet. Prices stay within $0.01 – $0.05 equivalent.
      </motion.p>
    </div>
  );
}
