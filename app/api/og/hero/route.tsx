import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

const gradient =
  'radial-gradient(circle at 20% 25%, rgba(112,215,255,0.35), transparent 55%), radial-gradient(circle at 78% 32%, rgba(162,129,255,0.28), transparent 60%), radial-gradient(circle at 38% 78%, rgba(98,211,180,0.22), transparent 58%), linear-gradient(135deg, #020711, #031836 38%, #140b2d)';

const baseBubbleStyles: Array<{ left: number; top: number; size: number; opacity: number }> = [
  { left: 12, top: 18, size: 120, opacity: 0.4 },
  { left: 72, top: 12, size: 80, opacity: 0.35 },
  { left: 78, top: 64, size: 140, opacity: 0.28 },
  { left: 18, top: 68, size: 96, opacity: 0.3 },
  { left: 45, top: 42, size: 54, opacity: 0.45 },
  { left: 58, top: 72, size: 62, opacity: 0.32 },
];

function renderBubble(style: { left: number; top: number; size: number; opacity: number }, index: number) {
  const offset = (index % 3) - 1;
  const scale = 1 + offset * 0.05;
  const background =
    'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.9), rgba(255,255,255,0.2) 40%, rgba(255,255,255,0) 70%)';
  return (
    <div
      key={`bubble-${index}`}
      style={{
        position: 'absolute',
        left: `${style.left}%`,
        top: `${style.top}%`,
        width: `${style.size * scale}px`,
        height: `${style.size * scale}px`,
        opacity: style.opacity,
        background,
        borderRadius: '50%',
        boxShadow: '0 18px 48px rgba(111, 214, 255, 0.25)',
        filter: 'blur(0.4px)',
      }}
    />
  );
}

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundImage: gradient,
          color: '#F8FBFF',
          fontFamily: 'Inter, "Plus Jakarta Sans", "Segoe UI", sans-serif',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 48,
            borderRadius: 40,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))',
            boxShadow: '0 40px 120px rgba(19, 56, 115, 0.45)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
        {baseBubbleStyles.map(renderBubble)}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            maxWidth: 840,
            padding: '0 48px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 32px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(248,251,255,0.86)',
              fontSize: 28,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
            }}
          >
            Bubble’it!
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              background: 'rgba(7,16,32,0.46)',
              borderRadius: 32,
              padding: '48px 60px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 28px 80px rgba(8, 24, 54, 0.35)',
            }}
          >
            <span style={{ fontSize: 82, fontWeight: 800, lineHeight: 1.02 }}>Pop. Win. Repeat.</span>
            <span style={{ fontSize: 30, fontWeight: 400, color: 'rgba(221,232,255,0.82)' }}>
              Fast arcade popping with boosts, rewards, and daily challenges on Base.
            </span>
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
