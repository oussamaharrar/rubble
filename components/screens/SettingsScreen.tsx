'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface SettingsScreenProps {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);

  const toggle = (key: 'sound' | 'haptics' | 'reducedMotion' | 'leftHanded') => () => {
    setSettings({ [key]: !settings[key] });
  };

  return (
    <motion.div
      className="screen-view"
      initial={{ opacity: 0, x: 28, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -28, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
    >
      <div className="screen-view__header">
        <h2 className="text-left text-2xl font-bold text-slate-100">Settings</h2>
        <button type="button" className="screen-button screen-button--ghost" onClick={onClose}>
          Back
        </button>
      </div>
      <div className="mt-6 flex w-full flex-col gap-4 text-left">
        <SettingToggle label="Sound effects" description="Bubble pops and rewards" active={settings.sound} onToggle={toggle('sound')} />
        <SettingToggle label="Haptics" description="Vibrate on perfect hits" active={settings.haptics} onToggle={toggle('haptics')} />
        <SettingToggle label="Reduced Motion" description="Simplify animations" active={settings.reducedMotion} onToggle={toggle('reducedMotion')} />
        <SettingToggle label="Left handed HUD" description="Flip controls" active={settings.leftHanded} onToggle={toggle('leftHanded')} />
      </div>
      <p className="screen-footer">Settings persist locally on your device.</p>
    </motion.div>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}

function SettingToggle({ label, description, active, onToggle }: SettingToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex flex-col rounded-3xl border px-5 py-4 text-left transition ${
        active ? 'border-sky-300/60 bg-sky-500/15' : 'border-white/10 bg-slate-900/40'
      }`}
    >
      <span className="text-base font-semibold text-slate-100">{label}</span>
      <span className="text-sm text-slate-400">{description}</span>
      <span className="mt-2 inline-flex h-7 w-16 items-center rounded-full bg-slate-800 p-1">
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${active ? 'translate-x-9 bg-sky-300' : 'translate-x-0'}`}
        />
      </span>
    </button>
  );
}
