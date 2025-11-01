#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import solc from 'solc';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  const rpcUrl = process.env.RPC_URL_BASE ?? process.env.BASE_RPC_URL;
  const privateKey = process.env.LEADER_RELAYER_PRIVATE_KEY;
  const season = (process.env.LEADER_SEASON ?? 'S1').trim() || 'S1';

  if (!rpcUrl) {
    console.error('[deploy] RPC_URL_BASE (or BASE_RPC_URL) is required');
    process.exit(1);
  }
  if (!privateKey) {
    console.error('[deploy] LEADER_RELAYER_PRIVATE_KEY is required');
    process.exit(1);
  }

  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(normalizedKey as `0x${string}`);

  const sourcePath = resolve(process.cwd(), 'contracts', 'Leaderboard.sol');
  const source = await readFile(sourcePath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: {
      'Leaderboard.sol': {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
  if (compiled.errors?.length) {
    for (const error of compiled.errors) {
      const isWarning = error.severity === 'warning';
      const prefix = isWarning ? '[solc][warning]' : '[solc][error]';
      console[isWarning ? 'warn' : 'error'](`${prefix} ${error.formattedMessage ?? error.message}`);
      if (!isWarning) {
        process.exit(1);
      }
    }
  }

  const artifact = compiled.contracts?.['Leaderboard.sol']?.Leaderboard;
  if (!artifact || !artifact.evm?.bytecode?.object) {
    console.error('[deploy] Failed to compile Leaderboard.sol');
    process.exit(1);
  }

  const abi = artifact.abi;
  const bytecode = `0x${artifact.evm.bytecode.object}`;

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  console.log(`[deploy] Deploying from ${account.address}`);
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [season, account.address],
  });

  console.log(`[deploy] Sent tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    console.error('[deploy] Deployment transaction mined without contract address');
    process.exit(1);
  }

  console.log('Leaderboard deployed');
  console.log(`ADDRESS=${receipt.contractAddress}`);
  console.log('ABI=contracts/Leaderboard.abi.json');
}

main().catch((error) => {
  console.error('[deploy] Failed to deploy leaderboard', error);
  process.exit(1);
});
