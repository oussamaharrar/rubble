'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import PayButton from '@/components/PayButton';
import { useGameStore } from '@/lib/store';
import { getBoard, shareUrl, type LeaderboardEntry } from '@/lib/leaderboard';
import type { BoardKind } from '@/types/game';
import type { LifetimeStats } from '@/components/StatsModal';

export type DrawerView = 'missions' | 'shop' | 'leaderboard' | 'howto' | 'stats';

interface DrawerProps {
  open: boolean;
  view: DrawerView;
  onClose: () => void;
  onSelect: (view: DrawerView) => void;
  onShowTutorial: () => void;
  highlight?: {
    board: BoardKind;
    score: number;
    combo: number;
    streak: number;
    dailyKey?: string;
    official?: boolean;
  } | null;
  lifetimeStats: LifetimeStats;
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
  const unlockFeature = useGameStore((state) => state.unlockFeature);
  const unlocks = useGameStore((state) => state.unlocks);
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const [message, setMessage] = useState<string | null>(null);

  const handleUseOrb = () => {
    void consumeBooster();
  };

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const handleThemeGranted = useCallback(() => {
    unlockFeature('themeSkies');
    setSettings({ theme: 'skies' });
    setMessage('Soothing Skies theme unlocked!');
  }, [setSettings, unlockFeature]);

  const handleFxGranted = useCallback(() => {
    unlockFeature('fxSparkle');
    setSettings({ particleStyle: 'sparkle' });
    setMessage('Sparkle FX unlocked!');
  }, [setSettings, unlockFeature]);

  const handleOrbBundle = useCallback(() => {
    grantBooster(3, 'paid');
    setMessage('Added +3 Energy Orbs!');
  }, [grantBooster]);

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
      <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 shadow-inner shadow-sky-500/30">
        <p className="text-sm font-semibold text-sky-100">Theme Pack · Soothing Skies</p>
        <p className="text-xs text-sky-100/80">Unlock an airy gradient preset with parallax clouds.</p>
        <div className="mt-3">
          {unlocks.themeSkies ? (
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
                Active: {settings.theme === 'skies' ? 'Skies' : 'Classic'}
              </span>
              <button
                type="button"
                onClick={() => setSettings({ theme: settings.theme === 'skies' ? 'default' : 'skies' })}
                className="button-tap rounded-full border border-sky-300/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100"
              >
                Toggle Theme
              </button>
            </div>
          ) : (
            <div className="max-w-xs">
              <PayButton sku="theme_pack_soothing_skies" label="Unlock Theme · 1 wei" onGranted={handleThemeGranted} />
            </div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4 shadow-inner shadow-violet-500/30">
        <p className="text-sm font-semibold text-violet-100">Particle Pack · Sparkle FX</p>
        <p className="text-xs text-violet-100/80">Add sparkle subparticles to Perfect pops and bursts.</p>
        <div className="mt-3">
          {unlocks.fxSparkle ? (
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-violet-500/25 px-3 py-1 text-xs font-semibold text-violet-100">
                {settings.particleStyle === 'sparkle' ? 'Sparkle Enabled' : 'Classic Particles'}
              </span>
              <button
                type="button"
                onClick={() => setSettings({ particleStyle: settings.particleStyle === 'sparkle' ? 'classic' : 'sparkle' })}
                className="button-tap rounded-full border border-violet-300/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-100"
              >
                Toggle FX
              </button>
            </div>
          ) : (
            <div className="max-w-xs">
              <PayButton sku="particle_pack_sparkle_fx" label="Unlock Sparkle · 1 wei" onGranted={handleFxGranted} />
            </div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 shadow-inner shadow-amber-500/20">
        <p className="text-sm font-semibold text-amber-100">Starter Orb Bundle</p>
        <p className="text-xs text-amber-100/80">Buy 3 extra Energy Orbs instantly via Base Pay.</p>
        <div className="mt-3 max-w-xs">
          <PayButton sku="starter_orb_bundle" label="Buy +3 Orbs · 1 wei" onGranted={handleOrbBundle} />
        </div>
      </div>
      {message ? (
        <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100">
          {message}
        </div>
      ) : null}
    </div>
  );
}

const BOARDS: { label: string; value: BoardKind }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Daily', value: 'daily' },
];

function LeaderboardView({
  highlight,
}: {
  highlight: DrawerProps['highlight'];
}) {
  const [activeBoard, setActiveBoard] = useState<BoardKind>('normal');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setEntries(getBoard(activeBoard));
  }, [activeBoard]);

  useEffect(() => {
    if (!highlight) return;
    setActiveBoard(highlight.board);
  }, [highlight]);

  useEffect(() => {
    const handler = () => setEntries(getBoard(activeBoard));
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [activeBoard]);

  const activeHighlight = useMemo(() => {
    if (!highlight) return null;
    if (highlight.board !== activeBoard) return null;
    return highlight;
  }, [activeBoard, highlight]);

  const shareHref = useMemo(() => {
    if (!activeHighlight) return '';
    return shareUrl({
      score: activeHighlight.score,
      board: activeHighlight.board,
      dailyKey: activeHighlight.dailyKey,
    });
  }, [activeHighlight]);

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="flex gap-2">
        {BOARDS.map((board) => (
          <button
            key={board.value}
            type="button"
            onClick={() => setActiveBoard(board.value)}
            className={clsx(
              'button-tap flex-1 rounded-2xl px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              activeBoard === board.value ? 'bg-sky-500/80 text-slate-900' : 'border border-white/10 bg-white/5 text-slate-200',
            )}
          >
            {board.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-300">No scores yet. Play a run to populate this board.</p>
        ) : (
          entries.map((entry, index) => {
            const highlighted =
              activeHighlight &&
              entry.score === activeHighlight.score &&
              entry.combo === activeHighlight.combo &&
              entry.streak === activeHighlight.streak;
            return (
              <div
                key={`${entry.date}-${entry.score}-${index}`}
                className={clsx(
                  'flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3',
                  highlighted && 'border-sky-400/70 bg-sky-500/10',
                )}
              >
                <div>
                  <p className="text-base font-semibold text-slate-100">{entry.score}</p>
                  <p className="text-xs text-slate-300">Combo ×{entry.combo} · Streak {entry.streak}</p>
                </div>
                <p className="text-xs text-slate-400">{new Date(entry.date).toLocaleString()}</p>
              </div>
            );
          })
        )}
      </div>
      {activeHighlight ? (
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
        className="button-tap w-full rounded-2xl border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
      >
        Launch Guided Tutorial
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

export default function Drawer({ open, view, onClose, onSelect, onShowTutorial, highlight, lifetimeStats }: DrawerProps) {
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
                {view === 'leaderboard' ? <LeaderboardView highlight={highlight} /> : null}
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
