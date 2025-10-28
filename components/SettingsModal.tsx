'use client';

import { useCallback } from 'react';
import Modal from './Modal';
import { useGameStore } from '@/lib/store';
import type { GameSettings } from '@/types/game';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingKey = 'haptics' | 'reducedMotion' | 'sound' | 'leftHanded';

const LABELS: Record<SettingKey, { title: string; description: string }> = {
  haptics: {
    title: 'Haptics',
    description: 'Enable device vibrations for taps, combos, and hazards when supported.',
  },
  reducedMotion: {
    title: 'Reduced Motion',
    description: 'Tone down visual effects and wobble for a calmer experience.',
  },
  sound: {
    title: 'Sound',
    description: 'Play lightweight chimes for taps, combos, and bursts.',
  },
  leftHanded: {
    title: 'Left-handed HUD',
    description: 'Swap action pill alignment for left-handed play.',
  },
};

function SettingsToggle({
  label,
  description,
  active,
  onToggle,
}: {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <div>
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="text-xs text-slate-300">{description}</p>
      </div>
      <span
        className={`flex h-6 w-10 items-center rounded-full p-1 transition ${
          active ? 'bg-sky-400/80' : 'bg-slate-600/70'
        }`}
        aria-hidden
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);

  const handleToggle = useCallback(
    (key: SettingKey) => {
      setSettings({ [key]: !settings[key] } as Partial<GameSettings>);
    },
    [setSettings, settings]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Close
        </button>
      }
    >
      <div className="space-y-3">
        {(Object.keys(LABELS) as SettingKey[]).map((key) => (
          <SettingsToggle
            key={key}
            label={LABELS[key].title}
            description={LABELS[key].description}
            active={settings[key]}
            onToggle={() => handleToggle(key)}
          />
        ))}
        <p className="text-[11px] text-slate-400">
          Preferences are stored locally under bubbleit_settings_v2. Haptics respect your device capabilities and browser support.
        </p>
      </div>
    </Modal>
  );
}
