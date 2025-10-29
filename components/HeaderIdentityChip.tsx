'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface HeaderIdentityChipProps {
  address: string;
  shortAddress: string;
  bubbles: number;
  onCopy: () => void;
  onManage: () => void;
  onDisconnect?: () => void;
  background?: string;
}

export default function HeaderIdentityChip({
  address,
  shortAddress,
  bubbles,
  onCopy,
  onManage,
  onDisconnect,
  background,
}: HeaderIdentityChipProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!menuRef.current || !toggleButtonRef.current) return;
      if (menuRef.current.contains(target) || toggleButtonRef.current.contains(target)) {
        return;
      }
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[data-menu-item]');
    first?.focus();
  }, [menuOpen]);

  const bubbleLabel = new Intl.NumberFormat().format(bubbles);

  return (
    <div className="relative">
      <div
        className={clsx(
          'group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/18 bg-white/12 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,23,42,0.32)] transition',
          'backdrop-blur-md focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-200'
        )}
        role="status"
        aria-label={`Connected wallet ${address}`}
        style={background ? { backgroundImage: background } : undefined}
      >
        <span className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/85">
          {shortAddress}
        </span>
        <span
          className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100"
          aria-label={`Bubbles balance ${bubbleLabel}`}
          data-testid="wallet-balance"
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-cyan-300" />
          {bubbleLabel}
        </span>
        <button
          ref={toggleButtonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="wallet-chip-menu"
          className="rounded-full bg-white/10 px-2 py-1 text-base font-bold text-white/90 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          onClick={() => setMenuOpen((value) => !value)}
        >
          ⋯
        </button>
      </div>
      <div
        ref={menuRef}
        id="wallet-chip-menu"
        role="menu"
        className={clsx(
          'absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-2xl border border-white/15 bg-slate-950/92 p-2 text-sm text-white shadow-xl shadow-black/50 backdrop-blur-xl',
          menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        style={{ transition: 'opacity 120ms ease, transform 160ms ease', transform: menuOpen ? 'translateY(0)' : 'translateY(-4px)' }}
      >
        <button
          type="button"
          role="menuitem"
          data-menu-item
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.26em] text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          onClick={() => {
            onCopy();
            setMenuOpen(false);
          }}
        >
          Copy address
        </button>
        <button
          type="button"
          role="menuitem"
          data-menu-item
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.26em] text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          onClick={() => {
            onManage();
            setMenuOpen(false);
          }}
        >
          Manage
        </button>
        {onDisconnect ? (
          <button
            type="button"
            role="menuitem"
            data-menu-item
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.26em] text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            onClick={() => {
              onDisconnect();
              setMenuOpen(false);
            }}
          >
            Disconnect
          </button>
        ) : null}
      </div>
    </div>
  );
}
