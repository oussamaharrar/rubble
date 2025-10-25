'use client';

export default function HowToPlayContent() {
  return (
    <div className="space-y-4 text-sm text-slate-200">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Core Loop</h3>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
          <li>Start with 60 seconds. Each bubble popped adds 0.5s and 10 points.</li>
          <li>Wrong taps or drain orbs subtract time and reset your combo timer.</li>
          <li>Chain 3+ of the same color within 5 seconds to build combo multipliers up to ×4.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Base Storms</h3>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
          <li>Every 30 seconds a 7-second Base Storm rains faster orbs.</li>
          <li>Energy Orbs glow blue, award +20 points and grant free Booster Orbs.</li>
          <li>Drain Orbs pulse red, costing 2 seconds and 15 points.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Boosters</h3>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
          <li>Use Energy Orbs from missions or storms for free slow-time.</li>
          <li>Paid boost triggers the same slow-time for 5 seconds via Base Pay.</li>
        </ul>
      </section>
    </div>
  );
}
