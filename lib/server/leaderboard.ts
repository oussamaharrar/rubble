import type { Address, HttpTransport, PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { PrivateKeyAccount } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import artifact from '../../contracts/Leaderboard.abi.json';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from './log-event';

const CONTRACT_ADDRESS = process.env.LEADER_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.LEADER_RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL_BASE ?? process.env.BASE_RPC_URL;
const RELAYER_ADDRESS = process.env.LEADER_RELAYER_ADDRESS;
const DIAG_ENABLED = process.env.DIAG === 'true';
const CHAIN_ID = baseSepolia.id;

const abi = (artifact as { abi: unknown }).abi as typeof artifact.abi;

type LeaderboardClients = {
  wallet: WalletClient<HttpTransport, typeof baseSepolia, PrivateKeyAccount>;
  reader: PublicClient<HttpTransport, typeof baseSepolia>;
  account: PrivateKeyAccount;
  address: Address;
};

let clients: LeaderboardClients | null = null;
let summaryLogged = false;

function mask(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function normalizeHex(value: string): `0x${string}` {
  return value.startsWith('0x') ? (value as `0x${string}`) : (`0x${value}` as `0x${string}`);
}

function logSummary(relayerCandidate?: string | null) {
  if (summaryLogged || !DIAG_ENABLED) {
    return;
  }
  const normalized = relayerCandidate ? normalizeAddress(relayerCandidate) : null;
  const relayerDisplay = normalized ? mask(normalized) : '—';
  const contractDisplay = CONTRACT_ADDRESS ? normalizeHex(CONTRACT_ADDRESS) : '—';
  console.info(`[leaderboard] CHAIN=${CHAIN_ID}`);
  console.info(`[leaderboard] RELAYER=${relayerDisplay}`);
  console.info(`[leaderboard] CONTRACT=${contractDisplay}`);
  console.info(`[leaderboard] RPC set=${RPC_URL ? 'true' : 'false'}`);
  summaryLogged = true;
}

const bootRelayer = (() => {
  if (RELAYER_ADDRESS) {
    return RELAYER_ADDRESS;
  }
  if (PRIVATE_KEY) {
    try {
      return privateKeyToAccount(normalizeHex(PRIVATE_KEY)).address;
    } catch {
      return null;
    }
  }
  return null;
})();

logSummary(bootRelayer);

function ensureClients() {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY || !RPC_URL) {
    return null;
  }
  if (!clients) {
    const account = privateKeyToAccount(normalizeHex(PRIVATE_KEY));
    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL),
    });
    const reader = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL),
    });
    clients = { wallet, reader, account, address: normalizeHex(CONTRACT_ADDRESS) as Address };
    if (!summaryLogged) {
      logSummary(account.address);
    }
  }
  return clients;
}

export function isLeaderboardConfigured() {
  return Boolean(CONTRACT_ADDRESS && PRIVATE_KEY && RPC_URL);
}

export async function readBest(address: string): Promise<number | null> {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return null;
  }
  const ctx = ensureClients();
  if (!ctx) {
    return null;
  }
  try {
    const value = await ctx.reader.readContract({
      abi,
      address: ctx.address,
      functionName: 'bestScore',
      args: [normalized as `0x${string}`],
    });
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  } catch (error) {
    console.warn('[leaderboard] failed to read bestScore', error);
    return null;
  }
}

export async function readSeason(): Promise<string | null> {
  const ctx = ensureClients();
  if (!ctx) {
    return null;
  }
  try {
    const value = await ctx.reader.readContract({
      abi,
      address: ctx.address,
      functionName: 'season',
    });
    return typeof value === 'string' ? value : `${value}`;
  } catch (error) {
    console.warn('[leaderboard] failed to read season', error);
    return null;
  }
}

export async function submitOnchain(player: string, score: number) {
  const normalized = normalizeAddress(player);
  if (!normalized) {
    throw new Error('Invalid player address');
  }
  const ctx = ensureClients();
  if (!ctx) {
    throw new Error('Leaderboard not configured');
  }
  const clamped = Math.min(10_000_000, Math.max(0, Math.floor(score)));
  const hash = await ctx.wallet.writeContract({
    abi,
    address: ctx.address,
    functionName: 'submit',
    args: [normalized as `0x${string}`, BigInt(clamped)],
  });
  const receipt = await ctx.reader.waitForTransactionReceipt({ hash });
  const latest = await ctx.reader.readContract({
    abi,
    address: ctx.address,
    functionName: 'bestScore',
    args: [normalized as `0x${string}`],
  });
  const bestScore = Number(latest);
  logEvent('leaderboard_tx', {
    txHash: hash,
    status: receipt.status,
    bestScore,
  });
  return { hash, bestScore };
}

export const leaderboardAbi = abi;
export const leaderboardAddress = CONTRACT_ADDRESS;
export const leaderboardRpcUrl = RPC_URL;
