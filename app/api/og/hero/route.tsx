import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

type BubbleSpec = {
  top: number;
  left: number;
  size: number;
  opacity: number;
};

const BUBBLES: BubbleSpec[] = [
  { top: 60, left: 120, size: 160, opacity: 0.34 },
  { top: 180, left: 420, size: 120, opacity: 0.26 },
  { top: 80, left: 760, size: 220, opacity: 0.32 },
  { top: 320, left: 180, size: 180, opacity: 0.22 },
  { top: 360, left: 520, size: 140, opacity: 0.28 },
  { top: 240, left: 940, size: 180, opacity: 0.24 },
  { top: 420, left: 760, size: 210, opacity: 0.2 },
];

function prefersReducedMotion(request: Request) {
  const header =
    request.headers.get('sec-ch-prefers-reduced-motion') ??
    request.headers.get('prefer-reduced-motion');
  return typeof header === 'string' && header.toLowerCase().includes('reduce');
}

export async function GET(request: Request) {
  const reducedMotion = prefersReducedMotion(request);
  const bubbles = (reducedMotion ? BUBBLES.slice(0, 3) : BUBBLES).map((bubble, index) => (
    <div
      key={index}
      style={{
        position: 'absolute',
        top: bubble.top,
        left: bubble.left,
        width: bubble.size,
        height: bubble.size,
        borderRadius: '50%',
        opacity: reducedMotion ? bubble.opacity * 0.6 : bubble.opacity,
        background:
          'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), rgba(165,243,252,0.15) 55%, rgba(14,116,144,0.05) 70%, transparent 80%)',
        filter: 'blur(0.5px)',
        boxShadow: '0 0 60px rgba(56,189,248,0.25)',
      }}
    />
  ));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '96px',
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(103,232,249,0.3), transparent 60%), radial-gradient(circle at 80% 30%, rgba(191,219,254,0.28), transparent 55%), linear-gradient(135deg, #020617 0%, #0f172a 48%, #1e3a8a 76%, #38bdf8 100%)',
          color: '#f8fafc',
          fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0',
            background:
              'radial-gradient(circle at 50% 30%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(circle at 40% 65%, rgba(14,165,233,0.12), transparent 55%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '0',
            background:
              'linear-gradient(140deg, rgba(15,23,42,0.1) 15%, rgba(8,47,73,0.08) 45%, transparent 70%)',
          }}
        />
        {bubbles}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '620px',
          }}
        >
          <span
            style={{
              fontSize: 32,
              letterSpacing: '0.38em',
              textTransform: 'uppercase',
              color: 'rgba(226,232,240,0.76)',
            }}
          >
            Bubble’it!
          </span>
          <h1
            style={{
              fontSize: 124,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              textShadow: '0 22px 50px rgba(15,118,230,0.35)',
            }}
          >
            Pop.&nbsp;Win.&nbsp;Repeat.
          </h1>
          <p
            style={{
              fontSize: 32,
              lineHeight: 1.4,
              color: 'rgba(226,232,240,0.85)',
            }}
          >
            Fast arcade popping with boosts, rewards, and daily challenges on Base.
          </p>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 72,
            right: 96,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 28,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'rgba(191,219,254,0.72)',
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(224,242,254,0.9), rgba(14,165,233,0.75))',
              boxShadow: '0 0 30px rgba(56,189,248,0.35)',
            }}
          />
          Base Arcade
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}

