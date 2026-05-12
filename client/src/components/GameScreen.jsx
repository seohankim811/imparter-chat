import React from 'react';
import CardBattle from './CardBattle';

const GAMES = {
  rts: {
    title: '⚔️ 잃도수 RTS',
    url: '/game.html'
  },
  keeper: {
    title: '🏰 갓물주 잃도수',
    url: '/keeper-idle/index.html'
  }
};

export default function GameScreen({ gameId, user, onBack }) {
  // React 내장 게임
  if (gameId === 'cardbattle') {
    return <CardBattle user={user} onBack={onBack} />;
  }

  const game = GAMES[gameId] || GAMES.rts;
  return (
    <div className="game-screen">
      <div className="game-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h3>{game.title}</h3>
      </div>
      <iframe
        src={game.url}
        className="game-iframe"
        title={game.title}
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
