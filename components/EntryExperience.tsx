'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import GameCanvas from '@/app/game/GameCanvas';
import GameplayHud from '@/components/GameplayHud';
import SettingsModal from '@/components/SettingsModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import EndOfRunOverlay from '@/components/EndOfRunOverlay';
import Modal from '@/components/Modal';
import PayButton from '@/components/PayButton';
import { VhFixProvider } from '@/components/VhFixProvider';
import HeaderIdentityChip from '@/components/HeaderIdentityChip';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { getRuntimeConfig } from '@/app/config/runtime';
import { shortenAddress, normalizeAddress } from '@/lib/address';
import { useToast } from '@/lib/use-toast';
import { logEvent } from '@/lib/telemetry';
import { fetchBestScore, issueRunTokenRequest, submitScoreRequest } from '@/lib/leaderboard-client';
import type { EntryMode } from '@/types/game';
import { getSiteConfig } from '@/lib/site-config';
import { useDailyRewardStore } from '@/lib/stores/daily-reward';
import { useRewardBoostStore } from '@/lib/stores/reward-boost';

type ScreenState = 'home' | 'playing' | 'paused';

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: 'daily' | 'normal';
  tagline?: string;
  referrerAddress?: string;
};

const SCREEN_DURATION = 0.24;
const SCREEN_EASE: [number, number, number, number] = [0.22, 0.88, 0.22, 1];

const backgroundKeyframes = [
  'radial-gradient(circle at 20% 20%, rgba(111,214,255,0.32), transparent 55%), radial-gradient(circle at 80% 30%, rgba(216,180,254,0.28), transparent 60%), linear-gradient(180deg, rgba(3,7,18,0.95), rgba(10,35,68,0.92))',
  'radial-gradient(circle at 60% 30%, rgba(167,91,255,0.28), transparent 55%), radial-gradient(circle at 25% 65%, rgba(111,214,255,0.35), transparent 60%), linear-gradient(180deg, rgba(3,7,18,0.9), rgba(4,21,45,0.92))',
];

const BUTTON_CLASS =
  'relative flex min-h-[52px] min-w-[220px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3 text-lg font-semibold uppercase tracking-[0.18em] text-white shadow-xl shadow-cyan-500/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200';

const GLASS_BUTTON_CLASS =
  'min-h-[48px] min-w-[48px] rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 hover:bg-white/16 transition';

const REMEMBER_KEY = 'rubble:remember';
const REMEMBER_ADDRESS_KEY = 'rubble:address';
const TRIAL_KEY_PREFIX = 'rubble:trial';

function persistRememberedWallet(address: string | null): 0 | 1 {
  if (typeof window === 'undefined') return 0;
  if (address) {
    window.localStorage.setItem(REMEMBER_KEY, '1');
    window.localStorage.setItem(REMEMBER_ADDRESS_KEY, address);
    return 1;
  }
  window.localStorage.setItem(REMEMBER_KEY, '0');
  window.localStorage.removeItem(REMEMBER_ADDRESS_KEY);
  return 0;
}

function readRememberedFlag(): 0 | 1 {
  if (typeof window === 'undefined') return 0;
  return window.localStorage.getItem(REMEMBER_KEY) === '1' ? 1 : 0;
}

function readRememberedAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REMEMBER_ADDRESS_KEY);
}

function useWalletSession(onRememberChange?: (flag: 0 | 1, address: string | null) => void) {
  const setWallet = useWalletStore((state) => state.setWallet);
  const resetWallet = useWalletStore((state) => state.reset);
  const setChainId = useWalletStore((state) => state.setChainId);
  const [ready, setReady] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = window.ethereum as (typeof window.ethereum) & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      request?: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
    };
    if (!provider?.request) {
      setHasProvider(false);
      persistRememberedWallet(null);
      onRememberChange?.(0, null);
      resetWallet();
      setReady(true);
      return;
    }
    setHasProvider(true);

    let cancelled = false;

    const finishReady = () => {
      if (!cancelled) {
        setReady(true);
      }
    };

    const syncAccounts = async () => {
      try {
        const accounts = (await provider.request<string[]>({ method: 'eth_accounts' })) ?? [];
        const [primary] = accounts;
        if (!primary) {
          const flag = persistRememberedWallet(null);
          onRememberChange?.(flag, null);
          resetWallet();
          return;
        }
        const chain = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
        setWallet(primary, chain ? chain.toLowerCase() : null);
        const flag = persistRememberedWallet(primary);
        onRememberChange?.(flag, primary);
      } catch (error) {
        console.debug('[rubble] wallet sync failed', error);
      }
    };

    if (readRememberedFlag() === 1) {
      void (async () => {
        try {
          await syncAccounts();
        } finally {
          finishReady();
        }
      })();
    } else {
      finishReady();
    }

    const handleAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts)) return;
      const [primary] = accounts as string[];
      if (primary) {
        provider
          .request<string>({ method: 'eth_chainId' })
          .then((next) => {
            setWallet(primary, typeof next === 'string' ? next.toLowerCase() : null);
            const flag = persistRememberedWallet(primary);
            onRememberChange?.(flag, primary);
          })
          .catch(() => {
            setWallet(primary, null);
            const flag = persistRememberedWallet(primary);
            onRememberChange?.(flag, primary);
          });
      } else {
        const flag = persistRememberedWallet(null);
        onRememberChange?.(flag, null);
        resetWallet();
      }
    };

    const handleChainChanged = (next: unknown) => {
      if (typeof next !== 'string') return;
      setChainId(next.toLowerCase());
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [onRememberChange, resetWallet, setChainId, setWallet]);

  return { ready, hasProvider } as const;
}

function createIdenticonGradient(address: string | null) {
  if (!address) {
    return 'linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.25))';
  }
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}deg 78% 62% / 0.85), hsl(${(hue + 48) % 360}deg 82% 54% / 0.65))`;
}

function readStoredTickets(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem('rubble:tickets');
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function writeStoredTickets(value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('rubble:tickets', `${Math.max(0, Math.floor(value))}`);
}

function todayKey(prefix: string) {
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(
    2,
    '0'
  )}`;
  return `${prefix}:${key}`;
}

function referralStorageKey(inviter: string, invitee: string) {
  const day = todayKey('referral');
  return `${day}:${inviter}:${invitee}`;
}

function createRunId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function compactDayStamp(now = new Date()) {
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
}

function trialStorageKey(address: string) {
  const normalized = address.trim().toLowerCase();
  return `${TRIAL_KEY_PREFIX}:${compactDayStamp()}:${normalized}`;
}

export default function EntryExperience({
  shareScore,
  shareBoard,
  tagline = 'Pop. Win. Repeat.',
  referrerAddress,
}: EntryExperienceProps) {
  const [rememberFlag, setRememberFlag] = useState<0 | 1>(() => readRememberedFlag());
  const [rememberedAddress, setRememberedAddress] = useState<string | null>(() => readRememberedAddress());
  const { ready: walletReady, hasProvider } = useWalletSession((flag, address) => {
    setRememberFlag(flag);
    setRememberedAddress(address);
  });

  const runtime = useMemo(() => getRuntimeConfig(), []);
  const site = useMemo(() => getSiteConfig(), []);
  const prefersReducedMotion = useReducedMotion();
  const { toast, showToast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<ScreenState>('home');
  const [gateOpen, setGateOpen] = useState(false);
  const [noRunsOpen, setNoRunsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [tickets, setTickets] = useState<number>(() => readStoredTickets());
  const [trialAvailable, setTrialAvailable] = useState<boolean>(false);
  const [hudRect, setHudRect] = useState<DOMRectReadOnly | null>(null);
  const [stageRect, setStageRect] = useState<DOMRectReadOnly | null>(null);
  const [measureToken, setMeasureToken] = useState(0);
  const [mascotBounces, setMascotBounces] = useState(0);
  const [safeLogged, setSafeLogged] = useState(false);
  const [shareClaimedToday, setShareClaimedToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(todayKey('rubble:shared')) === 'done';
  });
  const [leaderboardStatus, setLeaderboardStatus] = useState<'idle' | 'loading' | 'disabled' | 'ready' | 'error'>('idle');
  const [bestScoreOnChain, setBestScoreOnChain] = useState<number | null>(null);
  const [leaderboardSeason, setLeaderboardSeason] = useState<string | null>(null);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [celebrateBest, setCelebrateBest] = useState(false);
  const [leaderboardRank, setLeaderboardRank] = useState<string>('—');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const runStateRef = useRef<{ started: boolean; ended: boolean; mode: EntryMode | null; startedAt: number }>(
    { started: false, ended: false, mode: null, startedAt: 0 }
  );
  const runTokenRef = useRef<
    { token?: string; runId: string; bestBefore: number; submitted: boolean; requested: boolean } | null
  >(null);
  const trialKeyRef = useRef<string | null>(null);
  const lastTrialLoggedRef = useRef<string | null>(null);
  const lastWalletAddressRef = useRef<string | null>(null);
  const shopSourceRef = useRef<'home' | 'header' | 'gate' | 'no_runs'>('home');
  const lastGateReasonRef = useRef<string | null>(null);
  const lastNoRunsLoggedRef = useRef(false);
  const referralClaimKeyRef = useRef<string | null>(null);
  const referralAttemptedRef = useRef(false);

  const walletAddress = useWalletStore((state) => state.address);
  const walletConnected = Boolean(walletAddress);
  const boosterOrbs = useGameStore((state) => state.boosterBank.freeOrbs);
  const rewardBoosts = useRewardBoostStore((state) => state.boosts);
  const refreshBoosts = useRewardBoostStore((state) => state.refresh);
  const grantRewardBoost = useRewardBoostStore((state) => state.grant);
  const dailyAvailable = useDailyRewardStore((state) => state.available);
  const claimDailyReward = useDailyRewardStore((state) => state.claimReward);
  const refreshDailyReward = useDailyRewardStore((state) => state.refresh);

  useEffect(() => {
    refreshBoosts();
  }, [refreshBoosts]);

  useEffect(() => {
    refreshDailyReward();
  }, [refreshDailyReward]);

  useEffect(() => {
    if (!walletAddress) {
      setLeaderboardStatus('idle');
      setBestScoreOnChain(null);
      return;
    }
    let cancelled = false;
    setLeaderboardStatus('loading');
    fetchBestScore(walletAddress)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setBestScoreOnChain(result.bestScore);
          if (runTokenRef.current && !runTokenRef.current.submitted) {
            runTokenRef.current.bestBefore = result.bestScore;
          }
          setLeaderboardSeason(result.season ?? null);
          setLeaderboardStatus('ready');
        } else if (result.reason === 'disabled') {
          setBestScoreOnChain(null);
          setLeaderboardSeason(null);
          setLeaderboardStatus('disabled');
        } else {
          setLeaderboardSeason(null);
          setLeaderboardStatus('error');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLeaderboardSeason(null);
          setLeaderboardStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  useEffect(() => {
    if (leaderboardStatus !== 'ready') {
      return;
    }
    requestRunCredential();
  }, [leaderboardStatus, requestRunCredential]);

  const hasDailyRewardBoost = useMemo(
    () => rewardBoosts.some((boost) => boost.source === 'daily'),
    [rewardBoosts]
  );
  const hasInviteBoost = useMemo(
    () => rewardBoosts.some((boost) => boost.source === 'invite'),
    [rewardBoosts]
  );
  const hasTreasureBoost = useMemo(
    () => rewardBoosts.some((boost) => boost.source === 'treasure'),
    [rewardBoosts]
  );
  const hasRewardBoost = hasDailyRewardBoost || hasInviteBoost || hasTreasureBoost;
  const hasTodayBonus = hasDailyRewardBoost || hasInviteBoost;
  const todayBoostLabel = hasDailyRewardBoost
    ? "Today’s Boost: +1"
    : hasInviteBoost
    ? 'Invite Boost: +1'
    : '';
  const resetWalletStore = useWalletStore((state) => state.reset);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const phase = useGameStore((state) => state.phase);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const setHudSafeArea = useGameStore((state) => state.setHudSafeArea);
  const stats = useGameStore((state) => state.stats);
  const treasureFound = useGameStore((state) => state.treasureFound);

  const identityGradient = useMemo(
    () => createIdenticonGradient(walletAddress ?? rememberedAddress),
    [rememberedAddress, walletAddress]
  );
  const shortAddress = useMemo(
    () => shortenAddress(walletAddress ?? rememberedAddress ?? ''),
    [rememberedAddress, walletAddress]
  );
  const showIdentityChip = walletConnected || (rememberFlag === 1 && Boolean(rememberedAddress));
  const checkingWallet = !showIdentityChip && (!hydrated || (rememberFlag === 1 && !walletReady));
  const leaderboardHighlight = useMemo(() => {
    if (typeof shareScore === 'number' && Number.isFinite(shareScore)) {
      return { board: shareBoard ?? 'normal', score: shareScore, combo: 0, streak: 0 } as const;
    }
    return null;
  }, [shareBoard, shareScore]);

  const normalizedReferrer = useMemo(() => (referrerAddress ? normalizeAddress(referrerAddress) ?? null : null), [referrerAddress]);
  const bestScoreLoading = leaderboardStatus === 'loading';

  const achievementsState = useMemo(
    () => ({
      combo: stats.bestCombo >= 10,
      rare: stats.rareHits >= 1,
      treasure: treasureFound,
    }),
    [stats.bestCombo, stats.rareHits, treasureFound]
  );
  const previousBestForCelebrate = runTokenRef.current?.bestBefore ?? bestScoreOnChain ?? 0;
  const overlayCelebrate = showEndOverlay && (celebrateBest || (leaderboardStatus !== 'ready' && stats.score > previousBestForCelebrate));

  const pendingModeRef = useRef<EntryMode | null>(null);

  const updateRemember = useCallback(
    (address: string | null) => {
      const flag = persistRememberedWallet(address);
      setRememberFlag(flag);
      setRememberedAddress(address);
    },
    []
  );

  useEffect(() => {
    setHydrated(true);
    setRememberFlag(readRememberedFlag());
    setRememberedAddress(readRememberedAddress());
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    setShareClaimedToday(window.localStorage.getItem(todayKey('rubble:shared')) === 'done');
  }, [hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShareClaimedToday(window.localStorage.getItem(todayKey('rubble:shared')) === 'done');
  }, [dailyAvailable]);

  const handleToast = useCallback(
    (message: string) => {
      showToast(message);
    },
    [showToast]
  );

  const requestRunCredential = useCallback(() => {
    if (!walletAddress) {
      return;
    }
    if (!runStateRef.current.started || runStateRef.current.ended) {
      return;
    }
    const tokenState = runTokenRef.current;
    if (!tokenState || tokenState.requested) {
      return;
    }
    const runId = tokenState.runId;
    tokenState.requested = true;
    issueRunTokenRequest(walletAddress)
      .then((response) => {
        const current = runTokenRef.current;
        if (!current || current.runId !== runId) {
          return;
        }
        if (response.ok) {
          current.runId = response.runId;
          if (response.token) {
            current.token = response.token;
          }
        } else {
          current.requested = false;
          if (typeof window !== 'undefined') {
            window.setTimeout(() => requestRunCredential(), 1_000);
          }
        }
      })
      .catch(() => {
        const current = runTokenRef.current;
        if (current && current.runId === runId) {
          current.requested = false;
          if (typeof window !== 'undefined') {
            window.setTimeout(() => requestRunCredential(), 1_000);
          }
        }
      });
  }, [walletAddress]);

  useEffect(() => {
    referralAttemptedRef.current = false;
  }, [normalizedReferrer, walletAddress]);

  useEffect(() => {
    if (!normalizedReferrer || !walletAddress) {
      return;
    }
    const invitee = walletAddress.toLowerCase();
    if (invitee === normalizedReferrer) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const key = referralStorageKey(normalizedReferrer, invitee);
    referralClaimKeyRef.current = key;
    if (window.localStorage.getItem(key) === '1') {
      return;
    }
    if (referralAttemptedRef.current) {
      return;
    }
    referralAttemptedRef.current = true;
    fetch('/api/referral/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviterAddress: normalizedReferrer, inviteeAddress: walletAddress }),
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload: unknown) => {
        const data = payload as {
          ok?: boolean;
          reward?: { type?: string; amount?: number };
          reason?: string;
        };
        if (data?.ok) {
          const reward = data.reward;
          const amount = reward?.amount && Number.isFinite(reward.amount) && reward.amount > 0 ? Math.floor(reward.amount) : 1;
          if (reward?.type === 'bubbles') {
            grantBooster(amount, 'other');
            handleToast(amount > 1 ? `Referral bonus! +${amount} bubbles credited.` : 'Referral bonus! +1 bubble credited.');
          } else {
            for (let index = 0; index < amount; index += 1) {
              grantRewardBoost('invite');
            }
            handleToast(amount > 1 ? `Referral boost unlocked! +${amount} boosts.` : 'Referral boost unlocked! +1 boost.');
          }
          window.localStorage.setItem(key, '1');
          logEvent('referral_claim', { inviter: normalizedReferrer, invitee, reward });
        } else if (data?.reason === 'duplicate') {
          window.localStorage.setItem(key, '1');
          logEvent('referral_duplicate', { inviter: normalizedReferrer, invitee });
        } else {
          referralAttemptedRef.current = false;
        }
      })
      .catch((error) => {
        console.warn('[referral] claim failed', error);
        referralAttemptedRef.current = false;
      });
  }, [normalizedReferrer, walletAddress, grantRewardBoost, grantBooster, handleToast]);

  useEffect(() => {
    if (!stageRef.current || typeof window === 'undefined') {
      return;
    }
    const node = stageRef.current;
    const updateRect = () => {
      setStageRect(node.getBoundingClientRect());
      setMeasureToken((value) => value + 1);
    };
    updateRect();
    const observer = new ResizeObserver(() => updateRect());
    observer.observe(node);
    window.addEventListener('resize', updateRect, { passive: true });
    window.addEventListener('orientationchange', updateRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('orientationchange', updateRect);
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      lastWalletAddressRef.current = null;
      return;
    }
    if (lastWalletAddressRef.current === walletAddress) {
      return;
    }
    lastWalletAddressRef.current = walletAddress;
    logEvent('wallet_connected', { address: walletAddress });
  }, [walletAddress]);

  const handleHudBounds = useCallback((rect: DOMRectReadOnly) => {
    setHudRect(rect);
  }, []);

  useEffect(() => {
    if (!stageRect || !hudRect) {
      return;
    }
    const top = Math.max(0, (hudRect.bottom - stageRect.top) / stageRect.height);
    const left = Math.max(0, (hudRect.left - stageRect.left) / stageRect.width);
    const right = Math.max(0, (stageRect.right - hudRect.right) / stageRect.width);
    const bottom = Math.max(0, (stageRect.bottom - hudRect.bottom) / stageRect.height);
    setHudSafeArea({ top, left, right, bottom });
    if (!safeLogged) {
      console.log('SPAWN: safe=true');
      setSafeLogged(true);
    }
  }, [hudRect, safeLogged, setHudSafeArea, stageRect]);

  useEffect(() => {
    if (!runtime.trialEnabled || typeof window === 'undefined') {
      setTrialAvailable(false);
      trialKeyRef.current = null;
      return;
    }
    if (!walletAddress) {
      setTrialAvailable(false);
      trialKeyRef.current = null;
      return;
    }
    const key = trialStorageKey(walletAddress);
    trialKeyRef.current = key;
    let status = window.localStorage.getItem(key);
    if (!status) {
      const legacyKey = `rubble:trial:${walletAddress.toLowerCase()}`;
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy === 'used') {
        window.localStorage.setItem(key, 'used');
      } else if (legacy) {
        window.localStorage.setItem(key, 'available');
      }
      if (legacy) {
        window.localStorage.removeItem(legacyKey);
        status = window.localStorage.getItem(key);
      }
    }
    if (!status) {
      window.localStorage.setItem(key, 'available');
      setTrialAvailable(true);
      if (lastTrialLoggedRef.current !== key) {
        logEvent('trial_granted', { address: walletAddress, key, source: 'fresh' });
        lastTrialLoggedRef.current = key;
      }
      return;
    }
    const available = status !== 'used';
    setTrialAvailable(available);
    if (available && lastTrialLoggedRef.current !== key) {
      logEvent('trial_granted', { address: walletAddress, key, source: 'existing' });
      lastTrialLoggedRef.current = key;
    }
  }, [runtime.trialEnabled, walletAddress]);

  const hasTicketsOrBoosts = tickets > 0 || boosterOrbs > 0 || hasTreasureBoost;
  const eligibleToPlay =
    walletConnected && (trialAvailable || hasTicketsOrBoosts || hasDailyRewardBoost || hasInviteBoost);

  useEffect(() => {
    console.log(
      `GATE: connected=${walletConnected} remember=${rememberFlag} trial=${trialAvailable} eligible=${eligibleToPlay}`
    );
  }, [eligibleToPlay, rememberFlag, trialAvailable, walletConnected]);

  useEffect(() => {
    if (gateOpen && eligibleToPlay) {
      setGateOpen(false);
    }
    if (noRunsOpen && eligibleToPlay) {
      setNoRunsOpen(false);
    }
  }, [eligibleToPlay, gateOpen, noRunsOpen]);

  useEffect(() => {
    if (!gateOpen) {
      lastGateReasonRef.current = null;
    }
  }, [gateOpen]);

  useEffect(() => {
    if (!noRunsOpen) {
      lastNoRunsLoggedRef.current = false;
    }
  }, [noRunsOpen]);

  useEffect(() => {
    if (phase === 'paused') {
      setScreen('paused');
    } else if (phase === 'playing' || phase === 'storm' || phase === 'intro') {
      setScreen('playing');
    } else if (phase === 'summary') {
      setScreen('home');
      if (!runStateRef.current.ended && runStateRef.current.started) {
        runStateRef.current.ended = true;
        const { stats: currentStats } = useGameStore.getState();
        const startedAt = runStateRef.current.startedAt;
        const durationMs =
          startedAt > 0
            ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
            : 0;
        logEvent('run_ended', {
          mode: runStateRef.current.mode,
          score: currentStats.score,
          durationMs: Math.max(0, Math.round(durationMs)),
          bestCombo: currentStats.bestCombo,
          streak: currentStats.streak,
        });
        const nextEligible =
          walletConnected && (trialAvailable || hasTicketsOrBoosts || hasDailyRewardBoost || hasInviteBoost);
        console.log(`RUN: started=true ended=true nextEligible=${nextEligible}`);
      }
      setShowEndOverlay(true);
    } else {
      setScreen('home');
    }
  }, [
    phase,
    trialAvailable,
    tickets,
    walletConnected,
    hasDailyRewardBoost,
    hasInviteBoost,
    hasTicketsOrBoosts,
  ]);

  useEffect(() => {
    if (phase !== 'summary') {
      return;
    }
    if (leaderboardStatus !== 'ready') {
      return;
    }
    if (!walletAddress) {
      return;
    }
    const tokenState = runTokenRef.current;
    if (!tokenState || tokenState.submitted) {
      return;
    }
    tokenState.submitted = true;
    setSubmittingScore(true);
    setSubmitError(null);
    submitScoreRequest({
      player: walletAddress,
      score: stats.score,
      comboMax: stats.bestCombo,
      hits: stats.totalHits ?? 0,
      rareHits: stats.rareHits,
      season: leaderboardSeason,
      token: tokenState.token,
      runId: tokenState.runId,
    })
      .then((response) => {
        if (!response.ok) {
          setSubmitError('Unable to sync score to Base. Try again soon.');
          return;
        }
        setBestScoreOnChain(response.bestScore);
        setLeaderboardSeason(response.season ?? leaderboardSeason ?? null);
        if (runTokenRef.current) {
          runTokenRef.current.bestBefore = response.bestScore;
        }
        const improved = response.bestScore > tokenState.bestBefore && response.bestScore === stats.score;
        setCelebrateBest(improved);
      })
      .catch(() => {
        setSubmitError('Unable to sync score to Base. Try again soon.');
      })
      .finally(() => {
        setSubmittingScore(false);
      });
  }, [
    leaderboardStatus,
    phase,
    stats.bestCombo,
    stats.rareHits,
    stats.score,
    stats.totalHits,
    leaderboardSeason,
    walletAddress,
  ]);

  useEffect(() => {
    if (phase !== 'summary' && showEndOverlay) {
      setShowEndOverlay(false);
    }
  }, [phase, showEndOverlay]);

  const handleConsumeTrial = useCallback(() => {
    if (typeof window !== 'undefined' && walletAddress) {
      const key = trialStorageKey(walletAddress);
      trialKeyRef.current = key;
      window.localStorage.setItem(key, 'used');
    }
    setTrialAvailable(false);
  }, [walletAddress]);

  const handleConsumeTicket = useCallback(() => {
    setTickets((prev) => {
      const next = Math.max(0, prev - 1);
      writeStoredTickets(next);
      return next;
    });
  }, []);

  const resetAfterSummary = useCallback(() => {
    resetToStart();
    runTokenRef.current = null;
    runStateRef.current = { started: false, ended: false, mode: null, startedAt: 0 };
    setScreen('home');
    setShowEndOverlay(false);
    setSubmitError(null);
    setSubmittingScore(false);
    setCelebrateBest(false);
  }, [resetToStart]);

  const handleGrantTicket = useCallback(
    (count: number, reason: string) => {
      if (count <= 0) return;
      setTickets((prev) => {
        const next = prev + count;
        writeStoredTickets(next);
        return next;
      });
      handleToast(reason);
    },
    [handleToast]
  );

  const handleDailyReward = useCallback(() => {
    const reward = claimDailyReward();
    if (!reward) {
      handleToast('Daily reward already claimed. Come back tomorrow!');
      return;
    }
    if (reward === 'boost') {
      handleToast('You claimed today’s boost! 🎉');
      logEvent('boost_granted', { reason: 'daily' });
    } else if (reward === 'bubbles') {
      handleToast('Bonus bubbles added to your bank!');
    } else {
      handleToast('Cosmetic reward queued—stay tuned!');
    }
  }, [claimDailyReward, handleToast]);

  const handleShareBoost = useCallback(() => {
    if (typeof window === 'undefined') return;
    const key = todayKey('rubble:shared');
    if (window.localStorage.getItem(key) === 'done') {
      handleToast('Share reward already collected today.');
      setShareClaimedToday(true);
      return;
    }
    const message = `I'm popping bubbles on Bubble’it! 🎈 Join me → ${site.siteUrl}`;
    const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(message)}`;
    const shareWindow = window.open(shareUrl, '_blank', 'noopener,noreferrer,width=640,height=720');
    if (!shareWindow) {
      handleToast('Unable to open Farcaster. Check pop-up settings and try again.');
      return;
    }
    logEvent('invite_shared', { channel: 'farcaster', status: 'opened' });
    const poll = window.setInterval(() => {
      if (shareWindow.closed) {
        window.clearInterval(poll);
        window.localStorage.setItem(key, 'done');
        setShareClaimedToday(true);
        grantRewardBoost('invite');
        handleToast('Thanks for sharing! +1 Boost added 🎁');
        logEvent('invite_shared', { channel: 'farcaster', status: 'completed' });
        logEvent('boost_granted', { reason: 'share' });
      }
    }, 700);
    window.setTimeout(() => {
      window.clearInterval(poll);
    }, 15000);
  }, [grantRewardBoost, handleToast, site.siteUrl]);

  const attemptConnect = useCallback(async () => {
    if (walletConnected) return;
    if (typeof window === 'undefined') return;
    if (!hasProvider || !window.ethereum) {
      dispatchWalletModalOpen();
      return;
    }
    try {
      const address = await ensureBaseNetwork();
      useWalletStore.getState().setWallet(address, BASE_CHAIN_ID_HEX);
      updateRemember(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect wallet.';
      handleToast(message);
    }
  }, [handleToast, hasProvider, updateRemember, walletConnected]);

  const showGate = useCallback(
    (reason: string) => {
      if (!gateOpen || lastGateReasonRef.current !== reason) {
        logEvent('gate_shown', { reason });
        lastGateReasonRef.current = reason;
      }
      setGateOpen(true);
    },
    [gateOpen]
  );

  const showNoRuns = useCallback(() => {
    if (!lastNoRunsLoggedRef.current) {
      logEvent('gate_shown', { reason: 'no_runs' });
      lastNoRunsLoggedRef.current = true;
    }
    setNoRunsOpen(true);
  }, []);

  const startGameplay = useCallback(
    (mode: EntryMode) => {
      pendingModeRef.current = mode;
      startRun(mode);
      beginGameplay();
      const runId = createRunId();
      runTokenRef.current = { runId, bestBefore: bestScoreOnChain ?? 0, submitted: false, requested: false };
      setCelebrateBest(false);
      setSubmitError(null);
      setLeaderboardRank('—');
      runStateRef.current = {
        started: true,
        ended: false,
        mode,
        startedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
      if (leaderboardStatus === 'ready') {
        requestRunCredential();
      }
      logEvent('run_started', {
        mode,
        trial: mode === 'trial',
        ticketsBefore: tickets,
        boosters: boosterOrbs,
        trialAvailable,
      });
      const remainingTickets = mode === 'trial' ? tickets : Math.max(0, tickets - 1);
      const nextTrialAvailable = mode === 'trial' ? false : trialAvailable;
      const nextEligible =
        walletConnected && (nextTrialAvailable || remainingTickets > 0 || boosterOrbs > 0 || hasRewardBoost);
      console.log(`RUN: started=true ended=false nextEligible=${nextEligible}`);
      if (mode === 'trial') {
        handleConsumeTrial();
      } else {
        handleConsumeTicket();
      }
      setScreen('playing');
      setGateOpen(false);
      setNoRunsOpen(false);
    },
    [
      beginGameplay,
      bestScoreOnChain,
      boosterOrbs,
      handleConsumeTicket,
      handleConsumeTrial,
      hasRewardBoost,
      leaderboardStatus,
      requestRunCredential,
      startRun,
      tickets,
      trialAvailable,
      walletConnected,
    ]
  );

  const handlePlayPress = useCallback(() => {
    if (!walletConnected) {
      showGate('wallet_required');
      return;
    }
    if (!eligibleToPlay) {
      showNoRuns();
      return;
    }
    const mode: EntryMode = trialAvailable ? 'trial' : 'paid';
    startGameplay(mode);
  }, [eligibleToPlay, showGate, showNoRuns, startGameplay, trialAvailable, walletConnected]);

  const handlePlayAgainFromSummary = useCallback(() => {
    resetAfterSummary();
    setTimeout(() => {
      handlePlayPress();
    }, 0);
  }, [handlePlayPress, resetAfterSummary]);

  const handleSummaryHome = useCallback(() => {
    resetAfterSummary();
  }, [resetAfterSummary]);

  const handleSummaryLeaderboard = useCallback(() => {
    resetAfterSummary();
    setShowScoreboard(true);
  }, [resetAfterSummary]);

  const handlePlayTrial = useCallback(() => {
    if (!walletConnected) {
      showGate('wallet_required');
      return;
    }
    if (!trialAvailable) {
      handleToast('No trial available. Earn or buy another run.');
      logEvent('gate_shown', { reason: 'trial_unavailable' });
      return;
    }
    startGameplay('trial');
  }, [handleToast, showGate, startGameplay, trialAvailable, walletConnected]);

  const openShop = useCallback(
    (source: 'home' | 'header' | 'gate' | 'no_runs') => {
      shopSourceRef.current = source;
      setShowMore(true);
    },
    []
  );

  const handleOpenMore = useCallback(() => {
    if (screen !== 'home') return;
    openShop('home');
  }, [openShop, screen]);

  const handleManageFromChip = useCallback(() => {
    setGateOpen(false);
    setNoRunsOpen(false);
    openShop('header');
  }, [openShop]);

  const handleManageFromGate = useCallback(() => {
    setGateOpen(false);
    setNoRunsOpen(false);
    openShop('gate');
  }, [openShop]);

  const handleManageFromNoRuns = useCallback(() => {
    setNoRunsOpen(false);
    openShop('no_runs');
  }, [openShop]);

  const handleDisconnect = useCallback(() => {
    updateRemember(null);
    resetWalletStore();
    setGateOpen(false);
    setNoRunsOpen(false);
  }, [resetWalletStore, updateRemember]);

  const handleCopyAddress = useCallback(async () => {
    const address = walletAddress ?? rememberedAddress;
    if (!address) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else if (typeof document !== 'undefined') {
        const helper = document.createElement('textarea');
        helper.value = address;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        document.body.removeChild(helper);
      }
      handleToast('Address copied!');
      console.log(`HEADER: short="${shortAddress}" bubbles=${boosterOrbs} copyToast=shown`);
    } catch {
      handleToast('Unable to copy address. Copy manually.');
    }
  }, [boosterOrbs, handleToast, rememberedAddress, shortAddress, walletAddress]);

  const handlePause = useCallback(() => {
    pauseRun();
    setScreen('paused');
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
    setScreen('playing');
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    if (runStateRef.current.started && !runStateRef.current.ended) {
      runStateRef.current.ended = true;
      const { stats: currentStats } = useGameStore.getState();
      const startedAt = runStateRef.current.startedAt;
      const durationMs =
        startedAt > 0 ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt : 0;
      logEvent('run_ended', {
        mode: runStateRef.current.mode,
        score: currentStats.score,
        durationMs: Math.max(0, Math.round(durationMs)),
        bestCombo: currentStats.bestCombo,
        streak: currentStats.streak,
        aborted: true,
      });
      const nextEligible =
        walletConnected && (trialAvailable || tickets > 0 || boosterOrbs > 0 || hasRewardBoost);
      console.log(`RUN: started=true ended=true nextEligible=${nextEligible}`);
    }
    runStateRef.current = { started: false, ended: false, mode: null, startedAt: 0 };
    resetToStart();
    setScreen('home');
  }, [boosterOrbs, hasRewardBoost, resetToStart, tickets, trialAvailable, walletConnected]);

  useEffect(() => {
    if (screen === 'playing') {
      console.log('HUD: visible=true');
    }
  }, [screen]);

  useEffect(() => {
    if (!walletConnected || !shortAddress) return;
    console.log(`HEADER: short="${shortAddress}" bubbles=${boosterOrbs} copyToast=idle`);
  }, [boosterOrbs, shortAddress, walletConnected]);

  useEffect(() => {
    if (screen !== 'home') {
      setGateOpen(false);
      setNoRunsOpen(false);
      setShowMore(false);
    }
  }, [screen]);

  useEffect(() => {
    if (showMore) {
      logEvent('shop_opened', { source: shopSourceRef.current });
    }
  }, [showMore]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const { body } = document;
    if (!body) return;
    const previousOverflow = body.style.overflow;
    if (screen === 'playing' || screen === 'paused') {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [screen]);

  useEffect(() => {
    if (!prefersReducedMotion && screen === 'home' && mascotBounces > 0) {
      const timer = setTimeout(() => setMascotBounces((value) => Math.max(0, value - 1)), 620);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [screen, mascotBounces, prefersReducedMotion]);

  const screenVariants = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
    }
    return {
      initial: { opacity: 0, x: '8%' },
      animate: { opacity: 1, x: '0%' },
      exit: { opacity: 0, x: '-6%' },
    };
  }, [prefersReducedMotion]);

  const transition = useMemo(() => ({ duration: prefersReducedMotion ? 0 : SCREEN_DURATION, ease: SCREEN_EASE }), [
    prefersReducedMotion,
  ]);

  const backgroundAnimation = useMemo(() => {
    if (prefersReducedMotion) {
      return { background: backgroundKeyframes[0] };
    }
    return { background: backgroundKeyframes };
  }, [prefersReducedMotion]);

  const priceRangeLabel = useMemo(() => {
    return `$${runtime.priceMin} – $${runtime.priceMax}`;
  }, [runtime.priceMax, runtime.priceMin]);

  return (
    <>
      <VhFixProvider />
      <div className="relative isolate min-h-screen overflow-hidden text-white" style={{ background: backgroundKeyframes[0] }}>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          animate={backgroundAnimation}
          transition={{ duration: prefersReducedMotion ? 0 : 12, repeat: prefersReducedMotion ? 0 : Infinity, ease: 'linear' }}
        />
        <div className="relative z-10 flex min-h-screen flex-col">
          {screen !== 'playing' ? (
            <header className="flex items-center justify-between px-6 pt-6">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Arcade by Rubble</span>
                <h1 className="text-4xl font-black sm:text-5xl">Bubble’it!</h1>
                <span className="text-sm font-medium text-white/60">{tagline}</span>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  className={clsx(
                    'relative flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl text-white shadow-lg shadow-cyan-500/20 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200',
                    dailyAvailable ? 'hover:bg-white/20' : 'cursor-not-allowed opacity-40',
                    hasDailyRewardBoost && !dailyAvailable && 'border-emerald-400/40 bg-emerald-500/15 shadow-emerald-500/30'
                  )}
                  onClick={handleDailyReward}
                  disabled={!dailyAvailable}
                  animate={
                    dailyAvailable && !prefersReducedMotion
                      ? { scale: [1, 1.08, 1], rotate: [0, -6, 3, 0] }
                      : undefined
                  }
                  transition={{
                    duration: 1.8,
                    repeat: dailyAvailable && !prefersReducedMotion ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
                  aria-label={dailyAvailable ? 'Claim daily reward' : 'Daily reward claimed'}
                >
                  🎁
                  {dailyAvailable ? (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-300" />
                  ) : null}
                  {!dailyAvailable && hasDailyRewardBoost ? (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-emerald-950">
                      ✓
                    </span>
                  ) : null}
                </motion.button>
                {showIdentityChip ? (
                  <HeaderIdentityChip
                    address={walletAddress ?? rememberedAddress ?? ''}
                    shortAddress={shortAddress}
                    bubbles={boosterOrbs}
                    onCopy={handleCopyAddress}
                    onManage={handleManageFromChip}
                    onDisconnect={handleDisconnect}
                    background={identityGradient}
                  />
                ) : checkingWallet ? (
                  <div
                    className="min-h-[44px] rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur"
                    aria-live="polite"
                  >
                    Checking wallet…
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="connect-wallet-home"
                    className={clsx(GLASS_BUTTON_CLASS, (!hasProvider || !walletReady) && 'cursor-not-allowed opacity-50')}
                    onClick={attemptConnect}
                    disabled={!hasProvider || !walletReady}
                  >
                    {walletReady ? 'Connect Wallet' : 'Checking…'}
                  </button>
                )}
              </div>
            </header>
          ) : null}

          {screen === 'home' ? (
            <AnimatePresence>
              {hasTodayBonus ? (
                <motion.div
                  key="daily-boost-chip"
                  className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow-lg shadow-emerald-500/10"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="text-base leading-none">✨</span>
                  <span>{todayBoostLabel}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          ) : null}

          <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-16">
            <AnimatePresence mode="wait">
              {screen === 'home' ? (
                <motion.section
                  key="home"
                  className="flex w-full max-w-4xl flex-col items-center gap-8 text-center"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  <motion.div
                    className="relative flex flex-col items-center gap-6"
                    onTap={() => setMascotBounces((value) => value + 1)}
                  >
                    <motion.div
                      className="flex h-36 w-36 items-center justify-center rounded-full bg-cyan-400/40 shadow-2xl shadow-cyan-500/30"
                      animate={
                        prefersReducedMotion
                          ? { scale: 1 }
                          : { scale: mascotBounces > 0 ? [1, 1.08, 0.95, 1.02, 1] : [1, 1.02, 0.98, 1.01, 1] }
                      }
                      transition={{ duration: mascotBounces > 0 ? 0.9 : 5, ease: 'easeInOut', repeat: mascotBounces > 0 ? 0 : Infinity }}
                    >
                      <span className="text-5xl">🫧</span>
                    </motion.div>
                    <p className="max-w-xl text-base text-white/80">
                      Tap the rainbow bubbles, chain combos, and watch the glow trail thicken as your streak climbs. Perfect pops trigger
                      haptics and short slow-mo bursts—keep the pulse alive!
                    </p>
                    <motion.button
                      data-testid="play-button"
                      type="button"
                      className={BUTTON_CLASS}
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.05, rotate: -1 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.94, rotate: 1 }}
                      onClick={handlePlayPress}
                    >
                      PLAY Bubble’it!
                    </motion.button>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
                      <span>Wallet required</span>
                      <span aria-hidden>•</span>
                      <span>Trials grant one run</span>
                      <span aria-hidden>•</span>
                      <span>Retries via boosts</span>
                    </div>
                  </motion.div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button type="button" className={GLASS_BUTTON_CLASS} onClick={() => setShowSettings(true)}>
                      Settings
                    </button>
                    <button type="button" className={GLASS_BUTTON_CLASS} onClick={() => setShowScoreboard(true)}>
                      Scoreboard
                    </button>
                    <button
                      type="button"
                      className={clsx(GLASS_BUTTON_CLASS, shareClaimedToday && 'cursor-not-allowed opacity-50')}
                      onClick={handleShareBoost}
                      disabled={shareClaimedToday}
                    >
                      Invite
                    </button>
                    <button type="button" className={GLASS_BUTTON_CLASS} onClick={handleOpenMore}>
                      More
                    </button>
                  </div>
                </motion.section>
              ) : null}

              {screen === 'playing' ? (
                <motion.section
                  key="play"
                  className="relative flex w-full max-w-4xl flex-1 items-center justify-center"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  <div
                    ref={stageRef}
                    data-testid="game-stage"
                    className="relative aspect-[9/16] w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl"
                  >
                    <GameCanvas />
                    <GameplayHud
                      accent="#6FD6FF"
                      glassBg="rgba(16,35,58,0.55)"
                      glassBorder="rgba(111,214,255,0.4)"
                      onPause={handlePause}
                      onBoundsChange={handleHudBounds}
                      containerRef={hudRef}
                      measureToken={measureToken}
                    />
                  </div>
                </motion.section>
              ) : null}

              {screen === 'paused' ? (
                <motion.section
                  key="paused"
                  className="relative flex w-full max-w-4xl flex-1 items-center justify-center"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  <div
                    ref={stageRef}
                    data-testid="game-stage"
                    className="relative aspect-[9/16] w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-black/70 shadow-2xl"
                  >
                    <GameCanvas />
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
                      <h2 className="text-2xl font-bold">Paused</h2>
                      <p className="max-w-sm text-sm text-white/70">
                        Take a breath, feel the pulse, then jump back in to keep your combo streak glowing.
                      </p>
                      <div className="flex flex-col gap-3">
                        <button type="button" className={BUTTON_CLASS} onClick={handleResume}>
                          Resume
                        </button>
                        <button
                          type="button"
                          className="min-h-[48px] rounded-full border border-white/25 bg-transparent px-6 py-3 text-base font-semibold text-white/80 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          onClick={handleExit}
                        >
                          Exit to Home
                        </button>
                      </div>
                    </div>
                    <GameplayHud
                      accent="#6FD6FF"
                      glassBg="rgba(16,35,58,0.55)"
                      glassBorder="rgba(111,214,255,0.4)"
                      onPause={handlePause}
                      onBoundsChange={handleHudBounds}
                      containerRef={hudRef}
                      measureToken={measureToken}
                    />
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {gateOpen && screen === 'home' ? (
                <motion.div
                  key="gate"
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="gate-title"
                    data-testid="play-gate"
                    className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/80 p-6 text-left shadow-2xl"
                  >
                    <h2 id="gate-title" className="text-2xl font-semibold">
                      Connect &amp; pop to enter
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      You need a Base wallet connection and either a free trial or a retry ticket to start a run.
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                      <button
                        type="button"
                        data-testid="gate-connect-wallet"
                        className={clsx(
                          GLASS_BUTTON_CLASS,
                          (!hasProvider || !walletReady) && 'cursor-not-allowed opacity-40'
                        )}
                        onClick={attemptConnect}
                        disabled={!hasProvider || !walletReady}
                      >
                        {walletReady ? 'Connect Wallet' : 'Checking…'}
                      </button>
                      {runtime.trialEnabled ? (
                        <button
                          type="button"
                          data-testid="gate-play-free"
                          className={clsx(GLASS_BUTTON_CLASS, !trialAvailable && 'opacity-40')}
                          onClick={handlePlayTrial}
                          disabled={!trialAvailable}
                        >
                          Play Free
                        </button>
                      ) : null}
                      <button type="button" className={GLASS_BUTTON_CLASS} onClick={handleManageFromGate}>
                        Earn / Buy
                      </button>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.25em] text-white/40">
                      Trials consumed on start · Tickets stored locally
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {noRunsOpen && screen === 'home' ? (
                <motion.div
                  key="no-runs"
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 px-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="no-runs-title"
                    data-testid="no-runs-dialog"
                    className="w-full max-w-md rounded-3xl border border-white/18 bg-slate-900/85 p-6 text-left shadow-2xl backdrop-blur"
                  >
                    <h2 id="no-runs-title" className="text-2xl font-semibold text-white">
                      No runs left today
                    </h2>
                    <p className="mt-2 text-sm text-white/75">
                      Grab another boost, retry ticket, or invite a friend to earn one more shot before midnight.
                    </p>
                    <div className="mt-6 grid gap-3">
                      <button type="button" className={GLASS_BUTTON_CLASS} onClick={handleManageFromNoRuns}>
                        Buy
                      </button>
                      <button
                        type="button"
                        className={GLASS_BUTTON_CLASS}
                        onClick={() => {
                          openShop('no_runs');
                          setNoRunsOpen(false);
                        }}
                      >
                        Go to Rewards
                      </button>
                      <button
                        type="button"
                        className={GLASS_BUTTON_CLASS}
                        onClick={() => {
                          handleShareBoost();
                          setNoRunsOpen(false);
                        }}
                        disabled={shareClaimedToday}
                      >
                        Invite a Friend
                      </button>
                    </div>
                    <button
                      type="button"
                      className="mt-5 block w-full rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur hover:bg-white/10"
                      onClick={() => setNoRunsOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>
        </div>

        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
        <LeaderboardModal
          open={showScoreboard}
          onClose={() => setShowScoreboard(false)}
          highlight={leaderboardHighlight}
        />

        <EndOfRunOverlay
          open={showEndOverlay}
          score={stats.score}
          bestScore={bestScoreOnChain}
          loadingBest={bestScoreLoading}
          submitting={submittingScore}
          error={submitError}
          rank={leaderboardRank}
          achievements={achievementsState}
          celebrate={overlayCelebrate}
          onPlayAgain={handlePlayAgainFromSummary}
          onClose={handleSummaryHome}
          onShowLeaderboard={handleSummaryLeaderboard}
          onShare={handleShareBoost}
        />

        <Modal
          open={showMore}
          onClose={() => setShowMore(false)}
          title="Boost your Bubble’it! energy"
          className="bg-slate-950/90"
          footer={
            <button type="button" className={GLASS_BUTTON_CLASS} onClick={() => setShowMore(false)}>
              Close
            </button>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold">Daily Reward</h3>
              <p className="mt-1 text-sm text-white/70">
                Claim once per day for surprise boosts, bonus bubbles, or cosmetic drops.
              </p>
              <button
                type="button"
                className={clsx(GLASS_BUTTON_CLASS, !dailyAvailable && 'cursor-not-allowed opacity-50')}
                onClick={handleDailyReward}
                disabled={!dailyAvailable}
              >
                {dailyAvailable ? 'Claim Daily Reward' : 'Come back tomorrow'}
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold">Share &amp; Invite</h3>
              <p className="mt-1 text-sm text-white/70">Post your streak on Farcaster for a +1 boost each day.</p>
              <button
                type="button"
                className={clsx(GLASS_BUTTON_CLASS, shareClaimedToday && 'cursor-not-allowed opacity-50')}
                onClick={handleShareBoost}
                disabled={shareClaimedToday}
              >
                Share on Farcaster
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold">Shop</h3>
              <p className="mt-1 text-sm text-white/70">Micro-price add-ons, payable via existing Base checkout. {priceRangeLabel}</p>
              <div className="mt-3 flex flex-col gap-3">
                <PayButton
                  sku="bundle_retry_ticket"
                  label={`Retry Ticket — $${runtime.priceMin}`}
                  successMessage="Retry unlocked!"
                  onGranted={() => handleGrantTicket(1, 'Retry purchased! +1 ticket')}
                />
                <PayButton
                  sku="bundle_slow_mo"
                  label={`Slow-Mo Spark · $${runtime.priceMax}`}
                  successMessage="Slow-mo boost ready!"
                  onGranted={() => grantBooster(1, 'paid')}
                />
              </div>
            </div>
          </div>
        </Modal>

        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              className="fixed bottom-6 left-1/2 z-30 w-[min(90vw,360px)] -translate-x-1/2 rounded-full border border-cyan-400/60 bg-black/80 px-4 py-3 text-center text-sm text-cyan-100 shadow-lg shadow-cyan-500/30"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={transition}
            >
              {toast.message}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
