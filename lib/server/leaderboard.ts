import 'server-only';

import crypto from 'node:crypto';
import { createPublicClient, createWalletClient, http, isAddress } from 'viem';
import type { Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import leaderboardArtifact from '@/contracts/abi.Leaderboard.json';
import { getEnv } from '@/lib/env';

const MAX_SCORE = 10_000_000;
const TOKEN_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 4_000;
const RATE_LIMIT_SIZE = 512;

type LeaderboardArtifact = {
  abi: Abi;
  bytecode: `0x${string}`;
};

type RunTokenPayload = {
  address: string;
  nonce: string;
  issuedAt: number;
};

type VerifiedToken = RunTokenPayload & { valid: true };

type LeaderboardClients = {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  contractAddress: `0x${string}`;
  relayerAddress: `0x${string}`;
  hmacKey?: string;
  season: string;
};

type SubmitResult = {
  bestScore: bigint;
  txHash: `0x${string}`;
};

type LeaderboardAvailability =
  | ({ enabled: true } & LeaderboardClients)
  | { enabled: false; reason: string; hmacKey?: string; season: string };

const artifact = leaderboardArtifact as LeaderboardArtifact;

let cachedClients: LeaderboardAvailability | null = null;
const submissionLimiter = new Map<string, number>();

function maskAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function resolveClients(): LeaderboardAvailability {
  if (cachedClients) {
    return cachedClients;
  }
  const env = getEnv();
  const contractAddress = env.LEADER_CONTRACT_ADDRESS;
  const rpcUrl = env.RPC_URL_BASE;
  const privateKeyRaw = env.LEADER_RELAYER_PRIVATE_KEY;
  const season = env.LEADER_SEASON?.trim() || 'S1';
  const hmacKey = env.LEADER_HMAC_KEY?.trim();

  if (!contractAddress || !rpcUrl || !privateKeyRaw) {
    const missing: string[] = [];
    if (!contractAddress) missing.push('LEADER_CONTRACT_ADDRESS');
    if (!rpcUrl) missing.push('RPC_URL_BASE');
    if (!privateKeyRaw) missing.push('LEADER_RELAYER_PRIVATE_KEY');
    cachedClients = {
      enabled: false,
      reason: `missing env: ${missing.join(', ')}`,
      hmacKey,
      season,
    };
    return cachedClients;
  }

  const privateKey = privateKeyRaw.startsWith('0x') ? privateKeyRaw : (`0x${privateKeyRaw}` as const);
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: baseSepolia, transport });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport });

  cachedClients = {
    enabled: true,
    publicClient,
    walletClient,
    contractAddress: contractAddress as `0x${string}`,
    relayerAddress: account.address,
    hmacKey,
    season,
  };

  console.info(
    `[leaderboard] CHAIN=${baseSepolia.id} RELAYER=${maskAddress(account.address)} CONTRACT=${contractAddress}`
  );

  return cachedClients;
}

export function isLeaderboardEnabled() {
  return resolveClients().enabled;
}

function cleanupLimiter(now: number) {
  if (submissionLimiter.size <= RATE_LIMIT_SIZE) {
    return;
  }
  for (const [key, value] of submissionLimiter.entries()) {
    if (now - value > RATE_LIMIT_WINDOW_MS) {
      submissionLimiter.delete(key);
    }
    if (submissionLimiter.size <= RATE_LIMIT_SIZE) {
      break;
    }
  }
}

function assertRateLimit(address: string) {
  const now = Date.now();
  const key = address.toLowerCase();
  const last = submissionLimiter.get(key) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    throw new Error('rate_limited');
  }
  submissionLimiter.set(key, now);
  cleanupLimiter(now);
}

function verifySignature(token: string, hmacKey: string): RunTokenPayload | null {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { payload: RunTokenPayload; sig: string };
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.payload?.address !== 'string' ||
      typeof parsed.payload?.nonce !== 'string' ||
      typeof parsed.payload?.issuedAt !== 'number' ||
      typeof parsed.sig !== 'string'
    ) {
      return null;
    }
    const expected = crypto
      .createHmac('sha256', hmacKey)
      .update(JSON.stringify(parsed.payload))
      .digest('hex');
    const provided = Buffer.from(parsed.sig, 'hex');
    const computed = Buffer.from(expected, 'hex');
    if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function issueRunToken(address: string) {
  const config = resolveClients();
  if (!config.enabled || !config.hmacKey) {
    return null;
  }
  const payload: RunTokenPayload = {
    address: address.toLowerCase(),
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  };
  const signature = crypto
    .createHmac('sha256', config.hmacKey)
    .update(JSON.stringify(payload))
    .digest('hex');
  const token = Buffer.from(JSON.stringify({ payload, sig: signature })).toString('base64url');
  return { token, payload };
}

export function verifyRunToken(token: string | undefined, address: string): VerifiedToken | null {
  const config = resolveClients();
  const normalizedAddress = address.toLowerCase();
  if (!config.enabled) {
    return null;
  }
  if (!config.hmacKey) {
    return { address: normalizedAddress, nonce: '', issuedAt: Date.now(), valid: true };
  }
  if (!token) {
    return null;
  }
  const payload = verifySignature(token, config.hmacKey);
  if (!payload || payload.address !== normalizedAddress) {
    return null;
  }
  if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
    return null;
  }
  return { ...payload, valid: true };
}

export async function readBestScore(address: string): Promise<bigint | null> {
  const config = resolveClients();
  if (!config.enabled) {
    return null;
  }
  if (!isAddress(address)) {
    throw new Error('invalid_address');
  }
  const best = await config.publicClient.readContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: 'bestScore',
    args: [address as `0x${string}`],
  });
  return best as bigint;
}

export async function submitScoreOnChain(player: string, score: number): Promise<SubmitResult> {
  const config = resolveClients();
  if (!config.enabled) {
    throw new Error('leaderboard_disabled');
  }
  if (!isAddress(player)) {
    throw new Error('invalid_address');
  }
  const normalizedScore = Math.max(0, Math.min(Math.floor(score), MAX_SCORE));
  assertRateLimit(player);
  const txHash = await config.walletClient.writeContract({
    address: config.contractAddress,
    abi: artifact.abi,
    functionName: 'submit',
    args: [player as `0x${string}`, BigInt(normalizedScore)],
  });
  await config.publicClient.waitForTransactionReceipt({ hash: txHash });
  const best = await readBestScore(player);
  return { bestScore: best ?? BigInt(0), txHash };
}

export function currentSeason() {
  const config = resolveClients();
  return config.season;
}
