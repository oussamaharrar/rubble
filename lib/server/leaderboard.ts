import type { Address, HttpTransport, PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { PrivateKeyAccount } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import artifact from '@/contracts/Leaderboard.abi.json';
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
  contract: Address;
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

function diagEnabled() {
  const flag = process.env.DIAG ?? process.env.NEXT_PUBLIC_DIAG;
  if (!flag) return false;
  const value = flag.toLowerCase();
  return value === 'true' || value === '1';
}

function logSummary(ctx: LeaderboardClients) {
  if (summaryLogged || !diagEnabled()) {
    return;
  }
  const relayerSource = normalizeAddress(RELAYER_ADDRESS ?? ctx.account.address) ?? ctx.account.address;
  console.info('CHAIN=84532');
  console.info(`RELAYER=${mask(relayerSource)}`);
  console.info(`CONTRACT=${ctx.contract}`);
  console.info(`RPC set=${String(Boolean(RPC_URL))}`);
  summaryLogged = true;
}

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
    clients = {
      wallet,
      reader,
      account,
      contract: normalizeHex(CONTRACT_ADDRESS) as Address,
    };
    logSummary(clients);
  }
  return clients;
}

export function isLeaderboardConfigured() {
  return Boolean(CONTRACT_ADDRESS && PRIVATE_KEY && RPC_URL);
}

export async function readBest(playerAddress: string): Promise<number | null> {
  const normalized = normalizeAddress(playerAddress);
  if (!normalized) {
    return null;
  }
  const ctx = ensureClients();
  if (!ctx) {
    return null;
  }
  try {
    const result = await ctx.reader.readContract({
      abi,
      address: ctx.contract,
      functionName: 'bestScore',
      args: [normalized as `0x${string}`],
    });
    const numeric = Number(result);
    return Number.isFinite(numeric) ? numeric : 0;
  } catch (error) {
    console.warn('[leaderboard] failed to read bestScore', error);
    return null;
  }
}

export async function submitOnchain(playerAddress: string, score: number) {
  const normalized = normalizeAddress(playerAddress);
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
    address: ctx.contract,
    functionName: 'submit',
    args: [normalized as `0x${string}`, BigInt(clamped)],
  });
  const receipt = await ctx.reader.waitForTransactionReceipt({ hash: txHash });
  const latest = await ctx.reader.readContract({
    abi,
    address: ctx.contract,
    functionName: 'bestScore',
    args: [normalized as `0x${string}`],
  });
  const bestScore = Number(latest);
  logEvent('leaderboard_tx', { txHash, status: receipt.status, bestScore });
  return { hash: txHash, bestScore: Number.isFinite(bestScore) ? bestScore : clamped };
}

export const leaderboardAbi = abi;
