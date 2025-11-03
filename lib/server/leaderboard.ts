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
const RPC_URL = process.env.RPC_URL_BASE ?? undefined;
const RELAYER_ADDRESS = process.env.LEADER_RELAYER_ADDRESS;

const transport = RPC_URL ? http(RPC_URL) : null;

const abi = (artifact as { abi: unknown }).abi as typeof artifact.abi;

let publicClient: PublicClient<HttpTransport, typeof baseSepolia> | null = null;
let walletClient: WalletClient<HttpTransport, typeof baseSepolia, PrivateKeyAccount> | null = null;
let relayerAccount: PrivateKeyAccount | null = null;
let contractAddress: Address | null = null;
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

function logSummary() {
  if (summaryLogged || !diagEnabled()) {
    return;
  }
  const account = ensureRelayerAccount();
  if (!account || !contractAddress) {
    return;
  }
  const relayerSource = normalizeAddress(RELAYER_ADDRESS ?? account.address) ?? account.address;
  console.info('CHAIN=84532');
  console.info(`RELAYER=${mask(relayerSource)}`);
  console.info(`CONTRACT=${contractAddress}`);
  console.info(`RPC set=${String(Boolean(RPC_URL))}`);
  summaryLogged = true;
}

function ensureContractAddress() {
  if (!CONTRACT_ADDRESS) {
    return null;
  }
  if (!contractAddress) {
    contractAddress = normalizeHex(CONTRACT_ADDRESS) as Address;
  }
  return contractAddress;
}

function ensurePublicClient() {
  if (!transport || !CONTRACT_ADDRESS) {
    return null;
  }
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport,
    });
    ensureContractAddress();
    logSummary();
  }
  return publicClient;
}

function ensureRelayerAccount() {
  if (!PRIVATE_KEY) {
    return null;
  }
  if (!relayerAccount) {
    relayerAccount = privateKeyToAccount(normalizeHex(PRIVATE_KEY));
  }
  return relayerAccount;
}

function ensureWalletClient() {
  if (!transport || !CONTRACT_ADDRESS) {
    return null;
  }
  if (!walletClient) {
    const account = ensureRelayerAccount();
    if (!account) {
      return null;
    }
    walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport,
    });
    ensureContractAddress();
    logSummary();
  }
  return walletClient;
}

export function isLeaderboardConfigured() {
  return Boolean(CONTRACT_ADDRESS && PRIVATE_KEY && transport);
}

export async function readBest(playerAddress: string): Promise<number | null> {
  const normalized = normalizeAddress(playerAddress);
  if (!normalized) {
    return null;
  }
  const client = ensurePublicClient();
  const contract = ensureContractAddress();
  if (!client || !contract) {
    return null;
  }
  try {
    const result = await client.readContract({
      abi,
      address: contract,
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
  const contract = ensureContractAddress();
  const client = ensureWalletClient();
  if (!client || !contract) {
    throw new Error('Leaderboard not configured');
  }
  const clamped = Math.min(10_000_000, Math.max(0, Math.floor(score)));
  const txHash = await client.writeContract({
    abi,
    address: contract,
    functionName: 'submit',
    args: [normalized as `0x${string}`, BigInt(clamped)],
  });
  logEvent('leaderboard_tx', { txHash, score: clamped });
  return { hash: txHash };
}

export const leaderboardAbi = abi;

export function getPublicClient() {
  return ensurePublicClient();
}
