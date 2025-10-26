'use client';

const STEPS = [
  'Tap matching color bubbles to build streaks and combos. Wrong taps drain time.',
  'A target color appears every ~10 seconds. Hit it within 3 seconds for ×3 points and +2 seconds.',
  'Perfect taps land within 35% of the bubble radius for +5 points, +1s combo window, ripple and haptic.',
  'Use Boosts to trigger slow-time. Paid entries award +1 Energy Orb immediately.',
  'Pause anytime to tweak haptics, motion or handedness. Runs auto-pause on wallet modals.',
];

export default function HowToView() {
  return (
    <div className="space-y-3 text-sm text-slate-200">
      {STEPS.map((step, index) => (
        <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Tip {index + 1}</p>
          <p className="mt-1 text-sm text-slate-200">{step}</p>
        </div>
      ))}
      <p className="text-xs text-slate-400">
        Rubble Rush is tuned for a 424×695 logical pixel frame. Respect the safe areas and keep chrome minimal while playing.
      </p>
    </div>
  );
}
