'use client';

import { useCallback } from 'react';
import { useGameStore } from '@/lib/store';

interface SettingsScreenProps {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);

  const toggle = useCallback(
    (key: 'sound' | 'haptics' | 'reducedMotion' | 'leftHanded') => {
      const current = settings[key];
      setSettings({ [key]: !current });
    },
    [setSettings, settings],
  );

  return (
    <div className="screen-surface" data-active-screen="true">
      <div className="screen-surface__header">
        <button type="button" className="ui-button ui-button--ghost" onClick={onClose}>
          ← Back
        </button>
        <h2 className="text-xl font-bold uppercase tracking-[0.18em] text-slate-100">Settings</h2>
        <span className="w-[88px]" aria-hidden />
      </div>
      <div className="screen-surface__body">
        <div className="settings-list">
          <SettingToggle
            label="Sound Effects"
            hint="Always better with bubbles"
            description="Pop and burst cues keep the rhythm alive."
            value={settings.sound}
            onToggle={() => toggle('sound')}
          />
          <SettingToggle
            label="Haptics"
            hint="Only on perfect hits"
            description="Gentle vibrations reward combos and orbs."
            value={settings.haptics}
            onToggle={() => toggle('haptics')}
          />
          <SettingToggle
            label="Reduced Motion"
            hint="Steady seas"
            description="Minimize camera sway and particle storms."
            value={settings.reducedMotion}
            onToggle={() => toggle('reducedMotion')}
          />
          <SettingToggle
            label="Left-Handed HUD"
            hint="Thumb-friendly"
            description="Flip the HUD to keep controls within reach."
            value={settings.leftHanded}
            onToggle={() => toggle('leftHanded')}
          />
        </div>
      </div>
    </div>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
}

function SettingToggle({ label, description, hint, value, onToggle }: SettingToggleProps) {
  return (
    <div className="setting-toggle">
      <div className="setting-toggle__label">
        <span className="text-base font-semibold text-slate-100">{label}</span>
        <span className="text-sm text-slate-200/75">{description}</span>
        <span className="setting-toggle__hint">{hint}</span>
      </div>
      <button
        type="button"
        className="toggle-button"
        data-on={value}
        aria-pressed={value}
        onClick={onToggle}
      >
        <span className="sr-only">Toggle {label}</span>
      </button>
    </div>
  );
}
