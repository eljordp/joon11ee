import type { Metadata } from 'next';
import { Suspense } from 'react';
import CasinoPage from './CasinoClient';

const GAME_META: Record<string, { title: string; emoji: string; desc: string }> = {
  mp_blackjack: { title: 'Blackjack', emoji: '🃏', desc: 'Join the Blackjack table' },
  mp_crash: { title: 'Crash', emoji: '🚀', desc: 'Join the Crash game' },
  mp_craps: { title: 'Craps', emoji: '🎲', desc: 'Join the Craps table' },
  mp_dominoes: { title: 'Dominoes', emoji: '🁣', desc: 'Join the Dominoes game' },
  mp_poker: { title: 'Poker', emoji: '🂡', desc: 'Join the Poker table' },
  mp_spades: { title: 'Spades', emoji: '♠️', desc: 'Join the Spades game' },
  mp_hood_craps: { title: 'Hood Craps', emoji: '🎲', desc: 'Join the Hood Craps game' },
};

type Props = {
  searchParams: Promise<{ game?: string; room?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const game = params.game;
  const room = params.room;
  const meta = game ? GAME_META[game] : null;

  if (meta && room) {
    const title = `${meta.desc} | JOON11EE Casino`;
    const description = `You've been invited to play ${meta.title} on JOON11EE. Pull up!`;
    const ogImageUrl = `/api/og?game=${game}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImageUrl],
      },
    };
  }

  return {
    title: 'JOON11EE Casino | Blackjack, Poker, Crash & More',
    description: 'Multiplayer casino. Blackjack, Poker, Crash, Craps, Spades, and more. Play with friends.',
    openGraph: {
      title: 'JOON11EE Casino',
      description: 'Multiplayer casino. Blackjack, Poker, Crash, Craps, Spades, and more. Play with friends.',
      type: 'website',
      images: [{ url: '/api/og', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'JOON11EE Casino',
      description: 'Multiplayer casino. Blackjack, Poker, Crash, Craps, Spades, and more.',
      images: ['/api/og'],
    },
  };
}

export default function Page() {
  return (
    <Suspense>
      <CasinoPage />
    </Suspense>
  );
}
