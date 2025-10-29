'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

type WalletIdentityChipProps = {
  shortAddress: string;
  fullAddress: string;
  bubbles: number;
  gradient: string;
  onCopy: () => Promise<void> | void;
  onManage: () => void;
  onDisconnect?: () => void;
};

export function WalletIdentityChip({
  shortAddress,
  fullAddress,
  bubbles,
  gradient,
  onCopy,
  onManage,
  onDisconnect,
}: WalletIdentityChipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (event.target instanceof Node && containerRef.current.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative" data-testid="wallet-identity-chip">
      <div
        className={clsx(
          'flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm shadow-lg shadow-cyan-500/20 backdrop-blur focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-200',
          'transition-colors'
        )}
        style={{ backgroundImage: gradient }}
      >
        <span className="rounded-full bg-black/35 px-3 py-1 font-mono text-xs uppercase tracking-[0.22em] text-white/90">
          {shortAddress}
        </span>
        <span
          data-testid="wallet-balance"
          className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100"
        >
          <span aria-hidden className="text-base leading-none">
            ●
          </span>
          {bubbles}
        </span>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          className="button-tap flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-lg text-white/90 transition hover:bg-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          onClick={() => setOpen((value) => !value)}
          aria-label="Wallet menu"
        >
          ⋯
        </button>
      </div>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/90 p-2 text-sm text-white shadow-xl backdrop-blur"
        >
          <button
            type="button"
            role="menuitem"
            className="button-tap block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            onClick={async () => {
              await onCopy();
              setOpen(false);
            }}
          >
            Copy address
          </button>
          <button
            type="button"
            role="menuitem"
            className="button-tap mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            Manage
          </button>
          {onDisconnect ? (
            <button
              type="button"
              role="menuitem"
              className="button-tap mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-200 hover:bg-rose-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
            >
              Disconnect
            </button>
          ) : null}
          <p className="mt-2 px-3 text-[10px] uppercase tracking-[0.3em] text-white/40">{fullAddress}</p>
        </div>
      ) : null}
    </div>
  );
}
