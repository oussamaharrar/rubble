'use client';

interface HowToViewProps {
  tips: string[];
}

export default function HowToView({ tips }: HowToViewProps) {
  return (
    <div className="space-y-4 text-left">
      <p className="text-sm text-slate-300">Follow these essentials to maximize your run:</p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}
