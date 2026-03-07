import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

const GAMES: Record<string, { title: string; emoji: string; color: string; accent: string }> = {
  mp_blackjack: { title: 'BLACKJACK', emoji: '🃏', color: '#16a34a', accent: '#22c55e' },
  mp_crash: { title: 'CRASH', emoji: '🚀', color: '#dc2626', accent: '#ef4444' },
  mp_craps: { title: 'CRAPS', emoji: '🎲', color: '#2563eb', accent: '#3b82f6' },
  mp_dominoes: { title: 'DOMINOES', emoji: '🁣', color: '#7c3aed', accent: '#8b5cf6' },
  mp_poker: { title: 'POKER', emoji: '🂡', color: '#b91c1c', accent: '#dc2626' },
  mp_spades: { title: 'SPADES', emoji: '♠️', color: '#1e3a5f', accent: '#3b82f6' },
  mp_hood_craps: { title: 'HOOD CRAPS', emoji: '🎲', color: '#ca8a04', accent: '#eab308' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const gameId = searchParams.get('game');
  const game = gameId ? GAMES[gameId] : null;

  const title = game ? game.title : 'CASINO';
  const emoji = game ? game.emoji : '🎰';
  const color = game ? game.color : '#dc2626';
  const accent = game ? game.accent : '#ef4444';
  const subtitle = game ? 'JOIN THE TABLE' : 'FREE CRYPTO CASINO';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #111111 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '400px',
            background: `radial-gradient(ellipse, ${color}30 0%, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Bottom glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            right: '-50px',
            width: '400px',
            height: '300px',
            background: `radial-gradient(ellipse, ${color}15 0%, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Border frame */}
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            border: `1px solid ${color}40`,
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            zIndex: 1,
          }}
        >
          {/* Brand */}
          <div
            style={{
              fontSize: '18px',
              color: accent,
              letterSpacing: '8px',
              fontWeight: 700,
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            JOON11EE
          </div>

          {/* Emoji */}
          <div style={{ fontSize: '80px', display: 'flex', margin: '10px 0' }}>
            {emoji}
          </div>

          {/* Game title */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 900,
              color: 'white',
              letterSpacing: '6px',
              display: 'flex',
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '22px',
              color: accent,
              letterSpacing: '10px',
              fontWeight: 600,
              marginTop: '8px',
              display: 'flex',
            }}
          >
            {subtitle}
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '16px',
              color: '#71717a',
              letterSpacing: '4px',
              marginTop: '20px',
              display: 'flex',
            }}
          >
            $10K FREE CHIPS • NO REAL MONEY
          </div>
        </div>

        {/* Decorative cards for blackjack */}
        {gameId === 'mp_blackjack' && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '60px',
                left: '80px',
                width: '80px',
                height: '110px',
                background: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 900,
                color: '#000',
                transform: 'rotate(-15deg)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              A♠
            </div>
            <div
              style={{
                position: 'absolute',
                top: '50px',
                left: '140px',
                width: '80px',
                height: '110px',
                background: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 900,
                color: '#dc2626',
                transform: 'rotate(5deg)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              K♥
            </div>
          </>
        )}

        {/* Decorative chips */}
        {gameId === 'mp_poker' && (
          <>
            <div
              style={{
                position: 'absolute',
                bottom: '60px',
                right: '100px',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#dc2626',
                border: '4px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 900,
                color: 'white',
              }}
            >
              500
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '80px',
                right: '140px',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#1e40af',
                border: '4px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 900,
                color: 'white',
              }}
            >
              100
            </div>
          </>
        )}

        {/* Decorative dice */}
        {(gameId === 'mp_craps' || gameId === 'mp_hood_craps') && (
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              right: '100px',
              fontSize: '60px',
              display: 'flex',
              gap: '10px',
              transform: 'rotate(10deg)',
              opacity: 0.6,
            }}
          >
            🎲🎲
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
