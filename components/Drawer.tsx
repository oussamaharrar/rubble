'use client';

import { useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import PayButton from '@/components/PayButton';
import { useGameStore } from '@/lib/store';
import { shareUrl } from '@/lib/leaderboard';
import type { LifetimeStats } from '@/components/StatsModal';
import type { BoardKind } from '@/types/game';
import { useWalletStore } from '@/lib/wallet-store';
import { normalizeAddress, shortenAddress } from '@/lib/address';
import { useLeaderboardSnapshot } from '@/lib/hooks/use-leaderboard-snapshot';

export type DrawerView = 'missions' | 'shop' | 'leaderboard' | 'howto' | 'stats';

interface DrawerProps {
  open: boolean;
  view: DrawerView;
  onClose: () => void;
  onSelect: (view: DrawerView) => void;
  highlight?: {
    board: BoardKind;
    score: number;
    combo: number;
    streak: number;
    dailyKey?: string;
    official?: boolean;
  } | null;
  lifetimeStats: LifetimeStats;
  onShowTutorial: () => void;
  leaderboardRefreshToken?: number;
}

const VIEW_TABS: { label: string; value: DrawerView }[] = [
  { label: 'Missions', value: 'missions' },
  { label: 'Shop', value: 'shop' },
  { label: 'Leaderboard', value: 'leaderboard' },
  { label: 'How to', value: 'howto' },
  { label: 'Stats', value: 'stats' },
];

function MissionsView() {
  const missions = useGameStore((state) => state.missions);
  const claimMission = useGameStore((state) => state.claimMission);
  const freeOrbs = useGameStore((state) => state.boosterBank.freeOrbs);

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <p className="text-sm text-slate-300">Complete UTC missions for Booster Orbs. All three grant a bonus orb.</p>
      {missions.map((mission) => {
        const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
        const canClaim = mission.completed && !mission.claimed;
        return (
          <div key={mission.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{mission.label}</p>
                <p className="text-xs text-slate-400">Reward · +{mission.rewardOrbs} Booster Orb</p>
              </div>
              <button
                type="button"
                onClick={() => claimMission(mission.id)}
                className="button-tap rounded-xl border border-sky-400/40 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
                disabled={!canClaim}
              >
                {mission.claimed ? 'Claimed' : canClaim ? 'Claim' : `${progressPct}%`}
              </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/80">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-100">
        Free Booster Orbs available · {freeOrbs}
      </div>
    </div>
  );
}

function ShopView() {
  const freeOrbs = useGameStore((state) => state.boosterBank.freeOrbs);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const grantBoosterOrbs = useGameStore((state) => state.grantBooster);
  const unlockFeature = useGameStore((state) => state.unlockFeature);
  const unlocks = useGameStore((state) => state.unlocks);
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);

  const handleUseOrb = () => {
    void consumeBooster();
  };

  const handleThemeGranted = useCallback(() => {
    unlockFeature('themeSkies');
    setSettings({ theme: 'soothing-skies' });
  }, [setSettings, unlockFeature]);

  const handleSparkleGranted = useCallback(() => {
    unlockFeature('fxSparkle');
    setSettings({ sparkleFx: true });
  }, [setSettings, unlockFeature]);

  const handleOrbBundleGranted = useCallback(() => {
    grantBoosterOrbs(3, 'paid');
  }, [grantBoosterOrbs]);

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="rounded-2xl border border-sky-400/30 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
        <p className="text-sm font-semibold text-slate-100">Booster Orbs</p>
        <p className="text-xs text-slate-300/80">Trigger slow-time instantly using earned orbs.</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">{freeOrbs} available</span>
          <button
            type="button"
            onClick={handleUseOrb}
            className="button-tap rounded-2xl border border-sky-400/40 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
            disabled={freeOrbs === 0}
          >
            Use Orb
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
        <p className="text-sm font-semibold text-slate-100">Boost on Base</p>
        <p className="text-xs text-slate-300/80">Pay 1 wei to trigger a 5s slow-time boost using the Base rail.</p>
        <div className="mt-3 max-w-xs">
          <PayButton label="Boost on Base · 1 wei" />
        </div>
      </div>
      <div className="rounded-2xl border border-sky-400/30 bg-slate-900/70 p-4 shadow-inner shadow-black/40">
        <p className="text-sm font-semibold text-slate-100">Theme Pack · Soothing Skies</p>
        <p className="text-xs text-slate-300/80">Unlock a calming gradient backdrop and switch anytime.</p>
        {unlocks.themeSkies ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-emerald-300/90">Unlocked. Choose your vibe:</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSettings({ theme: 'classic' })}
                className={clsx(
                  'button-tap flex-1 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-wide',
                  settings.theme === 'classic'
                    ? 'border border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                    : 'border border-white/10 bg-slate-900/60 text-slate-200'
                )}
                disabled={settings.theme === 'classic'}
              >
                Classic
              </button>
              <button
                type="button"
                onClick={() => setSettings({ theme: 'soothing-skies' })}
                className={clsx(
                  'button-tap flex-1 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-wide',
                  settings.theme === 'soothing-skies'
                    ? 'border border-sky-400/60 bg-sky-500/25 text-sky-100'
                    : 'border border-white/10 bg-slate-900/60 text-slate-200'
                )}
                disabled={settings.theme === 'soothing-skies'}
              >
                Soothing Skies
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 max-w-xs">
            <PayButton
              sku="feature_theme_soothing_skies"
              label="Unlock Theme · 1 wei"
              grantBooster={false}
              onGranted={handleThemeGranted}
              successMessage="Theme unlocked! Soothing Skies applied."
            />
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-violet-400/30 bg-slate-900/70 p-4 shadow-inner shadow-black/40">
        <p className="text-sm font-semibold text-slate-100">Particle Pack · Sparkle FX</p>
        <p className="text-xs text-slate-300/80">Add shimmering bursts to Perfect pops and charge releases.</p>
        {unlocks.fxSparkle ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-emerald-300/90">Sparkle FX unlocked. Toggle anytime:</p>
            <button
              type="button"
              onClick={() => setSettings({ sparkleFx: !settings.sparkleFx })}
              className={clsx(
                'button-tap w-full rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wide',
                settings.sparkleFx
                  ? 'border border-violet-400/60 bg-violet-500/20 text-violet-100'
                  : 'border border-white/10 bg-slate-900/60 text-slate-200'
              )}
            >
              {settings.sparkleFx ? 'Disable Sparkle FX' : 'Enable Sparkle FX'}
            </button>
          </div>
        ) : (
          <div className="mt-3 max-w-xs">
            <PayButton
              sku="feature_fx_sparkle"
              label="Unlock Sparkle FX · 1 wei"
              grantBooster={false}
              onGranted={handleSparkleGranted}
              successMessage="Sparkle FX unlocked!"
            />
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-amber-400/30 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
        <p className="text-sm font-semibold text-slate-100">Starter Orb Bundle</p>
        <p className="text-xs text-slate-300/80">Top up with +3 Energy Orbs instantly.</p>
        <div className="mt-3 max-w-xs">
          <PayButton
            sku="bundle_energy_orbs"
            label="Buy +3 Orbs · 1 wei"
            grantBooster={false}
            onGranted={handleOrbBundleGranted}
            successMessage="Added +3 Energy Orbs to your bank!"
          />
        </div>
      </div>
    </div>
  );
}

function formatUpdatedAt(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
    </div>
  );
}

function LeaderboardView({
  highlight,
  open,
  refreshToken,
}: {
  highlight: DrawerProps['highlight'];
  open: boolean;
  refreshToken: number;
}) {
  const walletAddress = useWalletStore((state) => state.address);
  const normalizedWallet = useMemo(() => normalizeAddress(walletAddress ?? undefined), [walletAddress]);
  const walletLabel = useMemo(() => shortenAddress(normalizedWallet ?? ''), [normalizedWallet]);
  const snapshot = useLeaderboardSnapshot({ enabled: open, address: walletAddress, refreshToken });
  const updatedLabel = useMemo(() => formatUpdatedAt(snapshot.topUpdatedAt), [snapshot.topUpdatedAt]);

  const shareHref = useMemo(() => {
    if (!highlight) return '';
    return shareUrl({
      score: highlight.score,
      board: highlight.board,
      dailyKey: highlight.dailyKey,
    });
  }, [highlight]);

  const topContent = snapshot.topLoading ? (
    <Spinner />
  ) : snapshot.topItems.length > 0 ? (
    <div className="mt-3 space-y-2">
      {snapshot.topItems.slice(0, 50).map((entry, index) => {
        const normalizedEntry = normalizeAddress(entry.address);
        const isYou = normalizedWallet && normalizedEntry === normalizedWallet;
        return (
          <div
            key={`${entry.address}-${index}`}
            className={clsx(
              'flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3',
              isYou && 'border-sky-400/70 bg-sky-500/10'
            )}
          >
            <div>
              <p className="text-base font-semibold text-slate-100">{index + 1}. {entry.bestScore}</p>
              <p className="text-xs text-slate-300">{isYou ? 'You' : shortenAddress(normalizedEntry ?? entry.address)}</p>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-sm font-semibold text-slate-100">Your Rank Only</p>
      <p className="mt-1 text-xs text-slate-300/80">
        Global placements are warming up. Keep chasing your personal best and we’ll sync the full leaderboard soon.
      </p>
    </div>
  );

  const bestValue = snapshot.bestLoading ? 'Loading…' : snapshot.bestScore ?? (snapshot.disabled ? 'Disabled' : '—');

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Top Players</p>
          {updatedLabel ? (
            <p className="text-[0.65rem] uppercase tracking-[0.24em] text-slate-500">Updated {updatedLabel}</p>
          ) : null}
        </div>
        {topContent}
      </div>
      <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-center">
        <p className="text-xs uppercase tracking-[0.28em] text-indigo-100/80">Your Best</p>
        <p className="mt-1 text-2xl font-semibold text-white">{bestValue}</p>
        <p className="mt-2 text-xs text-indigo-100/70">
          {normalizedWallet
            ? `Tracking for ${walletLabel}`
            : snapshot.disabled
              ? 'Leaderboard disabled.'
              : 'Connect a wallet to track your rank.'}
        </p>
      </div>
      {highlight && shareHref ? (
        <a
          href={shareHref}
          target="_blank"
          rel="noreferrer"
          className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
        >
          Share to Farcaster
        </a>
      ) : null}
    </div>
  );
}

const HOW_TO = [
  'Tap matching colors quickly to climb the combo multiplier.',
  'Storm phases spawn blue energy (good) and orange drain (bad) orbs.',
  'Target-of-the-moment halos grant ×3 points and +2s when hit in time.',
  'Perfect taps vibrate lightly, pulse a ripple, and extend combo windows.',
  'Use Booster Orbs or Base boosts to slow time during hectic waves.',
];

function HowToView({ onShowTutorial }: { onShowTutorial: () => void }) {
  return (
    <div className="space-y-3 text-left text-sm text-slate-200">
      {HOW_TO.map((tip, index) => (
        <div key={tip} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tip {index + 1}</p>
          <p className="mt-1 text-sm text-slate-200">{tip}</p>
        </div>
      ))}
      <button
        type="button"
        onClick={onShowTutorial}
        className="button-tap mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
      >
        <span aria-hidden>▶</span> Replay Tutorial
      </button>
    </div>
  );
}

function StatsView({ stats }: { stats: LifetimeStats }) {
  const average = stats.runs > 0 ? Math.round(stats.totalSeconds / stats.runs) : 0;
  return (
    <div className="grid grid-cols-2 gap-4 text-center text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Best Score</p>
        <p className="text-2xl font-semibold text-sky-200">{stats.bestScore}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Best Combo</p>
        <p className="text-2xl font-semibold text-amber-200">×{stats.bestCombo}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Runs Played</p>
        <p className="text-2xl font-semibold text-slate-100">{stats.runs}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Avg Survival</p>
        <p className="text-2xl font-semibold text-emerald-200">{average}s</p>
      </div>
    </div>
  );
}

export default function Drawer({
  open,
  view,
  onClose,
  onSelect,
  highlight,
  lifetimeStats,
  onShowTutorial,
  leaderboardRefreshToken = 0,
}: DrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-slate-950/70"
            aria-label="Close drawer"
          />
          <motion.div
            className="relative mx-auto w-full max-w-[var(--frame-w)] px-3 pb-3"
            initial={{ y: 40 }}
            animate={{ y: 0 }}
            exit={{ y: 40 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div
              className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-5 text-slate-100 shadow-2xl shadow-black/60"
              style={{ height: '70%' }}
            >
              <div className="mx-auto mb-4 flex w-full max-w-[260px] items-center justify-center">
                <span className="h-1.5 w-20 rounded-full bg-white/15" aria-hidden />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {VIEW_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => onSelect(tab.value)}
                    className={clsx(
                      'button-tap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                      view === tab.value
                        ? 'bg-sky-500/80 text-slate-900'
                        : 'border border-white/10 bg-white/5 text-slate-200',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="drawer-content mt-5 h-[calc(100%-88px)] overflow-y-auto pr-1">
                {view === 'missions' ? <MissionsView /> : null}
                {view === 'shop' ? <ShopView /> : null}
                {view === 'leaderboard' ? (
                  <LeaderboardView
                    highlight={highlight}
                    open={open && view === 'leaderboard'}
                    refreshToken={leaderboardRefreshToken}
                  />
                ) : null}
                {view === 'howto' ? <HowToView onShowTutorial={onShowTutorial} /> : null}
                {view === 'stats' ? <StatsView stats={lifetimeStats} /> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="button-tap absolute right-5 top-5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
