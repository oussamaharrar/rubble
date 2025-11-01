import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import artifact from '../contracts/Leaderboard.abi.json';

function mask(address: string) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function main() {
  const rpcUrl = process.env.RPC_URL_BASE;
  const privateKey = process.env.LEADER_RELAYER_PRIVATE_KEY;
  const season = process.env.LEADER_SEASON ?? 'S1';

  if (!rpcUrl) {
    throw new Error('RPC_URL_BASE is required');
  }
  if (!privateKey) {
    throw new Error('LEADER_RELAYER_PRIVATE_KEY is required');
  }

  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(normalizedKey as `0x${string}`);

  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const { abi, bytecode } = artifact as { abi: any; bytecode: `0x${string}` };

  console.info('[deploy] sending transaction…');
  const hash = await client.deployContract({
    abi,
    bytecode,
    account,
    args: [account.address, season],
  });

  console.info(`[deploy] tx hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error('Deployment failed: missing contract address');
  }

  console.info('[deploy] Leaderboard deployed');
  console.info(`  owner:   ${mask(account.address)}`);
  console.info(`  relayer: ${mask(account.address)}`);
  console.info(`  season:  ${season}`);
  console.info(`  address: ${receipt.contractAddress}`);
  console.info('ABI: contracts/Leaderboard.abi.json');
}

void main().catch((error) => {
  console.error('[deploy] failed', error);
  process.exitCode = 1;
});
