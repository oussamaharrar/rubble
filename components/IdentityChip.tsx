'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

type IdentityChipProps = {
  address: string;
  shortAddress: string;
  bubbles: number;
  background: string;
  onCopy: () => void;
  onManage: () => void;
  onDisconnect?: () => void;
};

export default function IdentityChip({
  address,
  shortAddress,
  bubbles,
  background,
  onCopy,
  onManage,
  onDisconnect,
}: IdentityChipProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener('mousedown', handleClick);
      window.addEventListener('keydown', handleKey);
    }
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const handleCopy = useCallback(() => {
    onCopy();
    setOpen(false);
  }, [onCopy]);

  const handleManage = useCallback(() => {
    onManage();
    setOpen(false);
  }, [onManage]);

  const handleDisconnect = useCallback(() => {
    if (onDisconnect) {
      onDisconnect();
    }
    setOpen(false);
  }, [onDisconnect]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'group relative flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur focus-within:ring-2 focus-within:ring-cyan-200/70 focus-within:ring-offset-2 focus-within:ring-offset-slate-900/0',
        'min-h-[44px] min-w-[180px]'
      )}
      style={{ background }}
      data-testid="identity-chip"
    >
      <div className="flex flex-1 items-center gap-2">
        <span
          className="flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]"
          aria-label={`Connected wallet ${address}`}
        >
          {shortAddress}
        </span>
        <span
          className="flex h-8 min-w-[44px] items-center justify-center rounded-full bg-black/45 px-2 text-xs font-semibold text-cyan-100"
          data-testid="bubbles-badge"
          aria-label={`Bubbles balance ${bubbles}`}
        >
          ● {bubbles}
        </span>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-lg font-semibold text-white/80 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          onClick={() => setOpen((value) => !value)}
          data-testid="identity-menu-button"
        >
          ⋯
        </button>
        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 top-12 z-50 min-w-[180px] rounded-2xl border border-white/15 bg-slate-900/95 p-2 text-sm shadow-lg pointer-events-auto"
            data-testid="identity-menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
              onClick={handleCopy}
              data-testid="menu-copy-address"
            >
              Copy address
              <span aria-hidden>⧉</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
              onClick={handleManage}
              data-testid="menu-manage"
            >
              Manage
              <span aria-hidden>↗</span>
            </button>
            {onDisconnect ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-red-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
                onClick={handleDisconnect}
                data-testid="menu-disconnect"
              >
                Disconnect
                <span aria-hidden>⎋</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
