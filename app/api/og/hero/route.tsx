import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

const backgroundGradient =
  'radial-gradient(circle at 20% 30%, rgba(111,214,255,0.35), transparent 55%), ' +
  'radial-gradient(circle at 80% 20%, rgba(216,180,254,0.32), transparent 60%), ' +
  'radial-gradient(circle at 70% 70%, rgba(56,189,248,0.24), transparent 62%), ' +
  'linear-gradient(135deg, #030712 0%, #0b1a3a 45%, #1b3b78 100%)';

const bubbleStyles = [
  { left: 120, top: 140, size: 72, opacity: 0.35 },
  { left: 980, top: 120, size: 94, opacity: 0.3 },
  { left: 920, top: 420, size: 64, opacity: 0.32 },
  { left: 260, top: 440, size: 88, opacity: 0.28 },
  { left: 600, top: 500, size: 52, opacity: 0.3 },
  { left: 460, top: 180, size: 58, opacity: 0.26 },
  { left: 740, top: 260, size: 76, opacity: 0.28 },
] as const;

function Bubble({ left, top, size, opacity }: (typeof bubbleStyles)[number]) {
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: '9999px',
        background:
          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.65), rgba(255,255,255,0.08))',
        boxShadow: '0 12px 30px rgba(13,110,253,0.25)',
        opacity,
        filter: 'blur(0.4px)',
      }}
    />
  );
}

export async function GET(request: Request) {
  const reducedMotion = request.headers.get('sec-ch-prefers-reduced-motion') === 'reduce';

  const bubbles = reducedMotion ? [] : bubbleStyles;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: backgroundGradient,
          color: '#f8fafc',
          fontFamily: '"Plus Jakarta Sans", "Inter", "Segoe UI", sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 15% 80%, rgba(59,130,246,0.24), transparent 60%), ' +
              'radial-gradient(circle at 85% 50%, rgba(14,165,233,0.18), transparent 65%)',
            opacity: 0.9,
          }}
        />
        {bubbles.map((style) => (
          <Bubble key={`${style.left}-${style.top}-${style.size}`} {...style} />
        ))}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 32,
            padding: '60px 120px',
            borderRadius: 48,
            background: 'linear-gradient(160deg, rgba(3,7,18,0.85), rgba(15,23,42,0.6))',
            border: '1px solid rgba(148, 197, 255, 0.25)',
            boxShadow: '0 32px 80px rgba(8,47,73,0.45)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              padding: '10px 22px',
              borderRadius: 999,
              border: '1px solid rgba(148,197,255,0.35)',
              background: 'rgba(15,23,42,0.45)',
              fontSize: 28,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
            }}
          >
            Bubble’it!
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <h1
              style={{
                fontSize: 86,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                textShadow: '0 18px 30px rgba(6,182,212,0.4)',
              }}
            >
              Pop. Win. Repeat.
            </h1>
            <p
              style={{
                fontSize: 28,
                maxWidth: 620,
                color: 'rgba(226,232,240,0.9)',
                lineHeight: 1.4,
              }}
            >
              Fast arcade popping with boosts, rewards, and daily challenges on Base.
            </p>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
