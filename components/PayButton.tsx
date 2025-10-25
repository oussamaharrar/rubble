'use client';

import { useState } from 'react';

const PAY_TO_ADDRESS = process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? '';
const MIN_PRICE_WEI = process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '';

interface EthereumRequestArgs<TParams = unknown[]> {
  method: string;
  params?: TParams;
}

type EthereumProvider = {
  request<TResponse = unknown, TParams = unknown[]>(args: EthereumRequestArgs<TParams>): Promise<TResponse>;
};

type SendTransactionParams = Array<{
  from: string;
  to: string;
  value: string;
}>;

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function toHexWei(value: string) {
  try {
    const numeric = BigInt(value);
    return `0x${numeric.toString(16)}`;
  } catch {
    return '0x0';
  }
}

export default function PayButton() {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const disabled = !PAY_TO_ADDRESS || status === 'pending';

  async function handlePay() {
    if (typeof window === 'undefined' || !window.ethereum) {
      setStatus('error');
      setMessage('Wallet not detected');
      return;
    }

    const provider = window.ethereum;

    try {
      setStatus('pending');
      setMessage('Confirm the transaction in your wallet');
      const [account] = await provider.request<string[]>({
        method: 'eth_requestAccounts',
      });
      const txHash = await provider.request<string, SendTransactionParams>({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: PAY_TO_ADDRESS,
            value: toHexWei(MIN_PRICE_WEI || '0'),
          },
        ],
      });

      const response = await fetch(process.env.NEXT_PUBLIC_WEBHOOK_URL ?? '/api/pay/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const payload = (await response.json()) as { ok?: boolean; reason?: string };
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.reason ?? 'Verification failed');
      }
      setStatus('success');
      setMessage('Boost active! 🎉');
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Payment failed';
      setStatus('error');
      setMessage(reason);
    }
  }

  return (
    <div className="pay-button-container">
      <button
        type="button"
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handlePay}
        disabled={disabled}
      >
        {status === 'pending' ? 'Waiting…' : 'Boost (Base)'}
      </button>
      {message && (
        <p className="mt-2 max-w-xs text-xs text-slate-200" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
