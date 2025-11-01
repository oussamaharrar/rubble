#!/usr/bin/env tsx
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createWalletClient, http, type Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

async function loadArtifact() {
  const artifactPath = path.resolve('contracts/abi.Leaderboard.json');
  const raw = await fs.readFile(artifactPath, 'utf8');
  const parsed = JSON.parse(raw) as { abi: Abi; bytecode: `0x${string}` };
  return { ...parsed, path: artifactPath };
}

async function main() {
  const rpcUrl = process.env.RPC_URL_BASE;
  const privateKeyRaw = process.env.LEADER_RELAYER_PRIVATE_KEY;
  const season = process.env.LEADER_SEASON?.trim() || 'S1';

  if (!rpcUrl) {
    throw new Error('RPC_URL_BASE is not configured');
  }
  if (!privateKeyRaw) {
    throw new Error('LEADER_RELAYER_PRIVATE_KEY is not configured');
  }

  const artifact = await loadArtifact();
  const privateKey = privateKeyRaw.startsWith('0x') ? privateKeyRaw : `0x${privateKeyRaw}`;
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  console.info(`Deploying Leaderboard contract (season=${season}) to Base Sepolia...`);
  console.info(`Relayer/owner address: ${account.address}`);

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    account,
    chain: baseSepolia,
    args: [season, account.address],
  });

  console.info(`Deployment tx hash: ${hash}`);
  const receipt = await walletClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error('Deployment failed: no contract address in receipt');
  }

  console.info(`Leaderboard deployed at: ${receipt.contractAddress}`);
  console.info(`ABI file: ${path.relative(process.cwd(), artifact.path)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
