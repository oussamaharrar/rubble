'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { playTapChime } from '@/lib/audio';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);

  const toggleSetting = useCallback(
    (key: 'sound' | 'haptics' | 'leftHanded' | 'reducedMotion') => () => {
      playTapChime({ pitch: 500 });
      setSettings({ [key]: !settings[key] });
    },
    [setSettings, settings]
  );

  return (
    <motion.section
      className="screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <h1>Settings</h1>
      <p>Tune your controls and accessibility. Sound is on by default for splashy taps.</p>
      <div className="glass-card w-full max-w-md rounded-3xl px-6 py-5 text-left text-sm">
        <SettingToggle
          label="Sound Effects"
          description="Enable bubbly pops and rewards"
          value={settings.sound}
          onToggle={toggleSetting('sound')}
        />
        <SettingToggle
          label="Haptics"
          description="Buzz only on perfect pops"
          value={settings.haptics}
          onToggle={toggleSetting('haptics')}
        />
        <SettingToggle
          label="Left-handed HUD"
          description="Flip the HUD for left thumb reach"
          value={settings.leftHanded}
          onToggle={toggleSetting('leftHanded')}
        />
        <SettingToggle
          label="Reduce Motion"
          description="Cut back on camera sway and FX"
          value={settings.reducedMotion}
          onToggle={toggleSetting('reducedMotion')}
        />
      </div>
      <button type="button" className="neon-button" onClick={() => onBack()}>
        Back to home
      </button>
    </motion.section>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}

function SettingToggle({ label, description, value, onToggle }: SettingToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span className="flex flex-col">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">{label}</span>
        <span className="text-xs text-slate-400">{description}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-9 w-16 items-center rounded-full border border-white/15 bg-slate-900/80 transition ${
          value ? 'shadow-[0_0_14px_var(--primary-glow)]' : ''
        }`}
        aria-pressed={value}
      >
        <span
          className={`bubble-highlight absolute inset-1 rounded-full bg-slate-800 transition ${
            value ? 'translate-x-7 bg-[var(--accent-color)]' : 'translate-x-0'
          }`}
          style={{ transform: value ? 'translateX(28px)' : 'translateX(0px)' }}
        />
        <span className="sr-only">Toggle {label}</span>
      </button>
    </label>
  );
}
