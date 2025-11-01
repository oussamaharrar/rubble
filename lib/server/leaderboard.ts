import { http, createPublicClient, createWalletClient, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import leaderboardAbiJson from '@/contracts/Leaderboard.abi.json';
import { getEnv } from '@/lib/env';
import { logEvent } from '@/lib/server/telemetry';

type LeaderboardAbi = typeof leaderboardAbiJson;

type LoadedContext = {
  onchain: boolean;
  contractAddress?: Address;
  season: string;
  hmacKey?: string;
  relayerAddress?: Address;
  publicClient?: ReturnType<typeof createPublicClient>;
  walletClient?: ReturnType<typeof createWalletClient>;
};

declare global {
  // eslint-disable-next-line no-var
  var __rubbleLeaderboardMemory?: Map<string, number>;
}

let cachedContext: LoadedContext | undefined;
let summaryLogged = false;

function getFallbackScores() {
  if (!globalThis.__rubbleLeaderboardMemory) {
    globalThis.__rubbleLeaderboardMemory = new Map();
  }
  return globalThis.__rubbleLeaderboardMemory;
}

function maskAddress(address?: Address) {
  if (!address) return 'n/a';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function loadContext(): LoadedContext {
  if (cachedContext) {
    return cachedContext;
  }
  const env = getEnv();
  const season = env.LEADER_SEASON || 'S1';
  const hmacKey = env.LEADER_HMAC_KEY;
  const contractAddress = env.LEADER_CONTRACT_ADDRESS as Address | undefined;

  if (!contractAddress) {
    cachedContext = { onchain: false, season, hmacKey };
    return cachedContext;
  }

  const rpcUrl = env.RPC_URL_BASE || env.BASE_RPC_URL;
  const context: LoadedContext = {
    onchain: true,
    contractAddress,
    season,
    hmacKey,
  };

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  context.publicClient = publicClient;

  let relayerAddress = env.LEADER_RELAYER_ADDRESS as Address | undefined;
  const privateKey = env.LEADER_RELAYER_PRIVATE_KEY;
  if (privateKey) {
    const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(normalized as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    context.walletClient = walletClient;
    if (!relayerAddress) {
      relayerAddress = account.address as Address;
    }
  }
  context.relayerAddress = relayerAddress;

  if (!summaryLogged) {
    const lines = [`CHAIN=84532`, `RELAYER=${maskAddress(relayerAddress)}`, `CONTRACT=${contractAddress}`];
    console.info(`[leaderboard]\n  ${lines.join('\n  ')}`);
    summaryLogged = true;
  }

  cachedContext = context;
  return context;
}

export function getLeaderboardConfig() {
  const ctx = loadContext();
  return {
    onchain: ctx.onchain,
    contractAddress: ctx.contractAddress,
    season: ctx.season,
    hmacKey: ctx.hmacKey,
    relayerAddress: ctx.relayerAddress,
  };
}

export async function readBestScore(address: Address) {
  const ctx = loadContext();
  if (!ctx.onchain || !ctx.contractAddress || !ctx.publicClient) {
    const fallback = getFallbackScores();
    const key = address.toLowerCase();
    return { bestScore: fallback.get(key) ?? 0, season: ctx.season };
  }
  const abi = leaderboardAbiJson as LeaderboardAbi;
  const best = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi,
    functionName: 'bestScore',
    args: [address],
  });
  const value = Number(best);
  return { bestScore: Number.isFinite(value) ? value : 0, season: ctx.season };
}

export async function submitScore(address: Address, score: number) {
  const ctx = loadContext();
  if (!ctx.onchain || !ctx.contractAddress || !ctx.walletClient || !ctx.publicClient) {
    const fallback = getFallbackScores();
    const key = address.toLowerCase();
    const current = fallback.get(key) ?? 0;
    const next = score > current ? score : current;
    fallback.set(key, next);
    return { bestScore: next, season: ctx.season };
  }

  const abi = leaderboardAbiJson as LeaderboardAbi;
  const hash = await ctx.walletClient.writeContract({
    address: ctx.contractAddress,
    abi,
    functionName: 'submit',
    args: [address, BigInt(score)],
  });
  logEvent('leader_submit_tx', { hash });
  await ctx.publicClient.waitForTransactionReceipt({ hash });
  const best = await ctx.publicClient.readContract({
    address: ctx.contractAddress,
    abi,
    functionName: 'bestScore',
    args: [address],
  });
  const value = Number(best);
  return { bestScore: Number.isFinite(value) ? value : 0, season: ctx.season };
}

export function resetLeaderboardCache() {
  cachedContext = undefined;
}
