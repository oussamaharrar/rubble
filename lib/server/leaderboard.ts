import { randomUUID } from 'node:crypto';
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

const abi = (artifact as { abi: unknown }).abi as typeof artifact.abi;

type LeaderboardClients = {
  wallet: WalletClient<HttpTransport, typeof baseSepolia, PrivateKeyAccount>;
  reader: PublicClient<HttpTransport, typeof baseSepolia>;
  account: PrivateKeyAccount;
  contractAddress: Address;
};

let clients: LeaderboardClients | null = null;
let summaryLogged = false;

function mask(address: string | null | undefined) {
  if (!address) return '—';
  const value = address.startsWith('0x') ? address : `0x${address}`;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function normalizeHex(value: string): `0x${string}` {
  return value.startsWith('0x') ? (value as `0x${string}`) : (`0x${value}` as `0x${string}`);
}

function logSummaryOnce(accountAddress?: string) {
  if (process.env.DIAG !== 'true') {
    return;
  }
  if (summaryLogged) {
    return;
  }
  summaryLogged = true;
  const relayer = normalizeAddress(RELAYER_ADDRESS ?? accountAddress ?? '') ?? accountAddress ?? null;
  console.info('CHAIN=84532');
  console.info(`RELAYER=${mask(relayer)}`);
  console.info(`CONTRACT=${CONTRACT_ADDRESS ?? '—'}`);
  console.info(`RPC set=${RPC_URL ? 'true' : 'false'}`);
}

function ensureClients() {
  if (!CONTRACT_ADDRESS || !PRIVATE_KEY || !RPC_URL) {
    logSummaryOnce();
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
    clients = {
      wallet,
      reader,
      account,
      contractAddress: normalizeHex(CONTRACT_ADDRESS) as Address,
    };
    logSummaryOnce(account.address);
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
      address: ctx.contractAddress,
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

let cachedSeason: string | null = null;
let lastSeasonFetch = 0;
const SEASON_TTL_MS = 60_000;

export async function readSeason(): Promise<string | null> {
  const now = Date.now();
  if (cachedSeason && now - lastSeasonFetch < SEASON_TTL_MS) {
    return cachedSeason;
  }
  const ctx = ensureClients();
  if (!ctx) {
    return cachedSeason;
  }
  try {
    const value = await ctx.reader.readContract({
      abi,
      address: ctx.contractAddress,
      functionName: 'season',
      args: [],
    });
    if (typeof value === 'string') {
      cachedSeason = value;
      lastSeasonFetch = now;
      return value;
    }
  } catch (error) {
    console.warn('[leaderboard] failed to read season', error);
  }
  return cachedSeason;
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
  const txHash = await ctx.wallet.writeContract({
    abi,
    address: ctx.contractAddress,
    functionName: 'submit',
    args: [normalized as `0x${string}`, BigInt(clamped)],
  });
  const receipt = await ctx.reader.waitForTransactionReceipt({ hash: txHash });
  const latest = await ctx.reader.readContract({
    abi,
    address: ctx.contractAddress,
    functionName: 'bestScore',
    args: [normalized as `0x${string}`],
  });
  const bestScore = Number(latest);
  logEvent('leaderboard_tx', {
    txHash,
    status: receipt.status,
    bestScore,
  });
  return { hash: txHash, bestScore };
}

export function createRunId() {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

logSummaryOnce();

export const leaderboardAbi = abi;
export const leaderboardAddress = CONTRACT_ADDRESS;
export const leaderboardRpcUrl = RPC_URL;
