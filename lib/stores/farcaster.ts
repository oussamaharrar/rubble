'use client';

import { create } from 'zustand';

export type FarcasterIdentity = {
  fid: number;
  username?: string | null;
  displayName?: string | null;
  pfpUrl?: string | null;
};

interface FarcasterState {
  identity: FarcasterIdentity | null;
  setIdentity: (identity: FarcasterIdentity | null) => void;
  updateIdentity: (patch: Partial<FarcasterIdentity>) => void;
}

function sanitize(identity: FarcasterIdentity | null): FarcasterIdentity | null {
  if (!identity) {
    return null;
  }
  return {
    fid: Math.floor(identity.fid),
    username: identity.username ?? null,
    displayName: identity.displayName ?? null,
    pfpUrl: identity.pfpUrl ?? null,
  };
}

export const useFarcasterStore = create<FarcasterState>((set) => ({
  identity: null,
  setIdentity: (identity) => set({ identity: identity ? sanitize(identity) : null }),
  updateIdentity: (patch) =>
    set((state) => {
      if (!state.identity) {
        if (typeof patch.fid === 'number' && Number.isFinite(patch.fid)) {
          return { identity: sanitize({
            fid: Math.floor(patch.fid),
            username: patch.username ?? null,
            displayName: patch.displayName ?? null,
            pfpUrl: patch.pfpUrl ?? null,
          }) };
        }
        return state;
      }
      const next: FarcasterIdentity = {
        fid: typeof patch.fid === 'number' && Number.isFinite(patch.fid)
          ? Math.floor(patch.fid)
          : state.identity.fid,
        username:
          patch.username !== undefined ? patch.username ?? null : state.identity.username ?? null,
        displayName:
          patch.displayName !== undefined ? patch.displayName ?? null : state.identity.displayName ?? null,
        pfpUrl: patch.pfpUrl !== undefined ? patch.pfpUrl ?? null : state.identity.pfpUrl ?? null,
      };
      return { identity: sanitize(next) };
    }),
}));
