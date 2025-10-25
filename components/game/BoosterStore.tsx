'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import PayButton from '@/components/PayButton';
import type { BoosterConfig } from '@/lib/game/types';

interface BoosterStoreProps {
  boosters: BoosterConfig[];
  walletConnected: boolean;
  onBoosterTriggered?: (type: string) => void;
}

type CooldownState = Record<string, number>;

export default function BoosterStore({ boosters, walletConnected, onBoosterTriggered }: BoosterStoreProps) {
  const [cooldowns, setCooldowns] = useState<CooldownState>({});

  useEffect(() => {
    if (!boosters.length) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; duration?: number }>).detail;
      if (!detail?.type) return;
      setCooldowns((prev) => ({
        ...prev,
        [detail.type!]: detail.duration ?? 0,
      }));
      onBoosterTriggered?.(detail.type);
    };
    window.addEventListener('rubble:booster', handler as EventListener);
    return () => window.removeEventListener('rubble:booster', handler as EventListener);
  }, [boosters.length, onBoosterTriggered]);

  useEffect(() => {
    if (Object.keys(cooldowns).length === 0) return;
    const interval = window.setInterval(() => {
      setCooldowns((prev) => {
        const next: CooldownState = {};
        let changed = false;
        Object.entries(prev).forEach(([key, value]) => {
          const nextValue = Math.max(0, value - 1000);
          if (nextValue > 0) {
            next[key] = nextValue;
          }
          if (nextValue !== value) changed = true;
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldowns]);

  return (
    <div className="space-y-4">
      {boosters.map((booster) => {
        const remaining = cooldowns[booster.type] ?? 0;
        const seconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
        return (
          <div
            key={booster.sku}
            className="rounded-3xl border border-sky-400/20 bg-slate-900/60 p-3 shadow-[0_16px_40px_rgba(56,189,248,0.12)]"
          >
            <div className="flex items-center gap-3">
              <Image
                src={booster.icon}
                alt={`${booster.label} icon`}
                width={52}
                height={52}
                className="rounded-full bg-slate-900/70 p-2"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-sky-50">{booster.label}</h3>
                <p className="text-xs text-slate-200/80">{booster.description}</p>
                {seconds > 0 && (
                  <p className="mt-1 text-xs font-semibold text-cyan-200">
                    Cooldown: {seconds}s
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3">
              <PayButton
                sku={booster.sku}
                label={booster.label}
                amountWei={booster.priceWei}
                boosterType={booster.type}
                durationMs={booster.durationMs}
                disabled={!walletConnected || seconds > 0}
                icon={<Image src={booster.icon} alt={`${booster.label} icon`} width={28} height={28} />}
              />
            </div>
          </div>
        );
      })}
      {!walletConnected && (
        <p className="text-center text-xs text-slate-200/70">
          Connect a Base wallet to unlock boosters.
        </p>
      )}
    </div>
  );
}
