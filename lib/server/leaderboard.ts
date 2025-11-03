import type { Address, HttpTransport, PublicClient } from 'viem';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { PrivateKeyAccount } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import artifact from '@/contracts/Leaderboard.abi.json';
import { normalizeAddress } from '@/lib/address';

const CONTRACT_ADDRESS = process.env.LEADER_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.LEADER_RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL_BASE ?? process.env.BASE_RPC_URL;
const RELAYER_ADDRESS = process.env.LEADER_RELAYER_ADDRESS;

const abi = (artifact as { abi: unknown }).abi as typeof artifact.abi;

const transport = RPC_URL ? http(RPC_URL) : null;
let readerClient: PublicClient<HttpTransport, typeof baseSepolia> | null = null;
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

export function logLeaderboardSummary(relayer?: string) {
  if (summaryLogged || !diagEnabled()) {
    return;
  }
  const contract = getLeaderboardContract();
  if (!contract) return;
  const relayerSource = normalizeAddress(RELAYER_ADDRESS ?? relayer ?? '') ?? relayer ?? RELAYER_ADDRESS;
  if (!relayerSource) return;
  console.info('CHAIN=84532');
  console.info(`RELAYER=${mask(relayerSource)}`);
  console.info(`CONTRACT=${contract}`);
  console.info(`RPC set=${String(Boolean(RPC_URL))}`);
  summaryLogged = true;
}

function ensurePublicClient() {
  if (!transport) {
    return null;
  }
  if (!readerClient) {
    readerClient = createPublicClient({
      chain: baseSepolia,
      transport,
    });
  }
  return readerClient;
}

export function getLeaderboardTransport() {
  return transport;
}

export function getLeaderboardPublicClient() {
  return ensurePublicClient();
}

export function getLeaderboardContract(): Address | null {
  if (!CONTRACT_ADDRESS) {
    return null;
  }
  return normalizeHex(CONTRACT_ADDRESS) as Address;
}

export function getRelayerAccount(): PrivateKeyAccount | null {
  if (!PRIVATE_KEY) {
    return null;
  }
  return privateKeyToAccount(normalizeHex(PRIVATE_KEY));
}

export function isLeaderboardConfigured() {
  return Boolean(CONTRACT_ADDRESS && PRIVATE_KEY && RPC_URL);
}

export async function readBest(playerAddress: string): Promise<number | null> {
  const normalized = normalizeAddress(playerAddress);
  if (!normalized) {
    return null;
  }
  const contract = getLeaderboardContract();
  const client = ensurePublicClient();
  if (!contract || !client) {
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

export const leaderboardAbi = abi;
