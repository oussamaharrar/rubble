import type { Address, HttpTransport, PublicClient } from 'viem';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import artifact from '@/contracts/Leaderboard.abi.json';
import { normalizeAddress } from '@/lib/address';

const CONTRACT_ADDRESS = process.env.LEADER_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL_BASE ?? null;
const RELAYER_ADDRESS = process.env.LEADER_RELAYER_ADDRESS;

const abi = (artifact as { abi: unknown }).abi as typeof artifact.abi;

let publicClient: PublicClient<HttpTransport, typeof baseSepolia> | null = null;
let summaryLogged = false;
const transport = RPC_URL ? http(RPC_URL) : null;
const contractAddress = CONTRACT_ADDRESS ? (CONTRACT_ADDRESS.startsWith('0x')
  ? (CONTRACT_ADDRESS as `0x${string}`)
  : (`0x${CONTRACT_ADDRESS}` as `0x${string}`))
  : null;

function mask(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
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
  const relayerSource = normalizeAddress(RELAYER_ADDRESS ?? '') ?? RELAYER_ADDRESS ?? null;
  console.info('CHAIN=84532');
  if (relayerSource) {
    console.info(`RELAYER=${mask(relayerSource)}`);
  }
  if (contractAddress) {
    console.info(`CONTRACT=${contractAddress}`);
  }
  console.info(`RPC set=${String(Boolean(RPC_URL))}`);
  summaryLogged = true;
}

export function isLeaderboardConfigured() {
  return Boolean(CONTRACT_ADDRESS && process.env.LEADER_RELAYER_PRIVATE_KEY && RPC_URL);
}

export async function readBest(playerAddress: string): Promise<number | null> {
  const normalized = normalizeAddress(playerAddress);
  if (!normalized) {
    return null;
  }
  if (!transport || !contractAddress) {
    return null;
  }
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport,
    });
    logSummary();
  }
  const client = publicClient;
  if (!client) {
    return null;
  }
  try {
    const result = await client.readContract({
      abi,
      address: contractAddress as Address,
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

export function getLeaderboardContractAddress(): Address | null {
  return contractAddress as Address | null;
}

export function getLeaderboardPublicClient(): PublicClient<HttpTransport, typeof baseSepolia> | null {
  if (!transport || !contractAddress) {
    return null;
  }
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: baseSepolia,
      transport,
    });
    logSummary();
  }
  return publicClient;
}
