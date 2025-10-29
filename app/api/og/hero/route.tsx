import { ImageResponse } from 'next/og';
import { getSiteConfig } from '@/lib/site-config';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

export async function GET() {
  const site = getSiteConfig();

  const background =
    'radial-gradient(circle at 20% 25%, rgba(111,214,255,0.55), transparent 58%),' +
    'radial-gradient(circle at 78% 28%, rgba(216,180,254,0.48), transparent 62%),' +
    'radial-gradient(circle at 30% 70%, rgba(79,209,197,0.4), transparent 60%),' +
    'linear-gradient(140deg, rgba(6,15,32,1) 0%, rgba(7,27,56,1) 38%, rgba(11,36,70,1) 78%)';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'Inter, Helvetica, "Segoe UI", sans-serif',
          color: '#ECFEFF',
          backgroundImage: background,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'space-between',
            padding: '80px',
          }}
        >
          {[120, 220, 160].map((bubbleSize, index) => (
            <div
              key={`${bubbleSize}-${index}`}
              style={{
                width: bubbleSize,
                height: bubbleSize,
                borderRadius: '50%',
                background:
                  index === 0
                    ? 'linear-gradient(135deg, rgba(111,214,255,0.65), rgba(148,232,255,0.4))'
                    : index === 1
                    ? 'linear-gradient(135deg, rgba(216,180,254,0.6), rgba(117,88,214,0.35))'
                    : 'linear-gradient(135deg, rgba(56,189,248,0.55), rgba(109,213,178,0.35))',
                opacity: 0.75,
                filter: 'blur(0px)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 120px',
            borderRadius: 40,
            background: 'rgba(3,7,18,0.45)',
            border: '1px solid rgba(148,232,255,0.35)',
            boxShadow: '0 30px 80px rgba(15,27,54,0.5)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <span
            style={{
              fontSize: 24,
              letterSpacing: '0.45em',
              textTransform: 'uppercase',
              color: 'rgba(148,232,255,0.9)',
            }}
          >
            Bubble’it!
          </span>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              textAlign: 'center',
              color: '#F8FAFC',
            }}
          >
            Pop &amp; Win
          </div>
          <div
            style={{
              fontSize: 30,
              color: 'rgba(224,242,254,0.9)',
              textAlign: 'center',
              maxWidth: 760,
            }}
          >
            {site.ogDescription}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 12,
            }}
          >
            {[1520, 680, 240].map((value, index) => (
              <div
                key={`${value}-${index}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '18px 28px',
                  borderRadius: 28,
                  background: 'rgba(9,27,52,0.6)',
                  border: '1px solid rgba(148,232,255,0.4)',
                  color: '#D1FAFF',
                  minWidth: 160,
                }}
              >
                <span style={{ fontSize: 14, letterSpacing: '0.25em' }}>●</span>
                <span style={{ fontSize: 28, fontWeight: 700 }}>{value.toLocaleString()}</span>
                <span style={{ fontSize: 16, opacity: 0.7 }}>
                  {index === 0 ? 'Bubbles popped' : index === 1 ? 'Combo max' : 'Daily boosts'}
                </span>
              </div>
            ))}
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
