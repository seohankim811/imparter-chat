import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

// ===== 카드 데이터 =====
// 타입 상성 순환: 🔥불 → 🌿자연 → 💧물 → 🧠정신 → 🔥
const TYPES = {
  fire: { emoji: '🔥', name: '불', color: '#ff5e3a' },
  nature: { emoji: '🌿', name: '자연', color: '#3acb6e' },
  water: { emoji: '💧', name: '물', color: '#3aa6ff' },
  mind: { emoji: '🧠', name: '정신', color: '#c46aff' }
};

// 누가 누구를 이김
const BEATS = {
  fire: 'nature',
  nature: 'water',
  water: 'mind',
  mind: 'fire'
};

const CARDS = {
  blackswan: [
    { id: 'sophie', name: 'Sophie Foster', emoji: '🌙', type: 'mind', hp: 30, atk: 12, desc: 'Moonlark / Inflictor', bg: 'linear-gradient(135deg,#6a4bd1,#2e1a6a)' },
    { id: 'keefe', name: 'Keefe Sencen', emoji: '😏', type: 'nature', hp: 28, atk: 13, desc: 'Empath', bg: 'linear-gradient(135deg,#4bd1a8,#1a6a52)' },
    { id: 'fitz', name: 'Fitz Vacker', emoji: '🎩', type: 'mind', hp: 27, atk: 12, desc: 'Telepath', bg: 'linear-gradient(135deg,#4b7ad1,#1a3a6a)' },
    { id: 'biana', name: 'Biana Vacker', emoji: '👻', type: 'water', hp: 26, atk: 13, desc: 'Vanisher', bg: 'linear-gradient(135deg,#4bd1c0,#1a6a5e)' },
    { id: 'dex', name: 'Dex Dizznee', emoji: '🔧', type: 'nature', hp: 32, atk: 10, desc: 'Technopath', bg: 'linear-gradient(135deg,#d1b54b,#6a571a)' }
  ],
  neverseen: [
    { id: 'fintan', name: 'Fintan Pyren', emoji: '🔥', type: 'fire', hp: 30, atk: 14, desc: 'Pyrokinetic', bg: 'linear-gradient(135deg,#d14b4b,#6a1a1a)' },
    { id: 'brant', name: 'Brant', emoji: '👨‍🦱', type: 'fire', hp: 28, atk: 13, desc: 'Pyrokinetic', bg: 'linear-gradient(135deg,#d16a4b,#6a2e1a)' },
    { id: 'vespera', name: 'Vespera', emoji: '🦂', type: 'mind', hp: 27, atk: 12, desc: 'Mind Manipulator', bg: 'linear-gradient(135deg,#7a4bd1,#3a1a6a)' },
    { id: 'gethen', name: 'Gethen', emoji: '🕴️', type: 'mind', hp: 26, atk: 13, desc: 'Telepath', bg: 'linear-gradient(135deg,#5a4bd1,#1a1a6a)' },
    { id: 'ruy', name: 'Ruy Ignis', emoji: '💎', type: 'water', hp: 32, atk: 10, desc: 'Phaser', bg: 'linear-gradient(135deg,#4bbcd1,#1a566a)' }
  ]
};

const FACTION_INFO = {
  blackswan: { name: '블랙스완', emoji: '🌹', desc: 'Sophie와 친구들', color: '#4bd1a8' },
  neverseen: { name: '마티치 (Neverseen)', emoji: '🖤', desc: 'Fintan과 추종자들', color: '#d14b4b' }
};

// ===== 게임 로직 =====
function resolveBattle(playerCard, enemyCard) {
  // 둘 다 살아있는 카드 가정
  let pDmg = 0, eDmg = 0; // 받는 데미지
  if (playerCard.type === enemyCard.type) {
    // 같은 타입: 둘 다 50% 데미지
    pDmg = Math.floor(enemyCard.atk * 0.5);
    eDmg = Math.floor(playerCard.atk * 0.5);
  } else if (BEATS[playerCard.type] === enemyCard.type) {
    // 플레이어 승: 적만 데미지
    eDmg = playerCard.atk;
  } else {
    // 적 승: 플레이어만 데미지
    pDmg = enemyCard.atk;
  }
  return { pDmg, eDmg };
}

function aiPickCard(aiHand, playerHand) {
  // 간단한 AI: 플레이어가 보유한 타입을 이기는 카드 우선, 없으면 ATK 최대값
  const playerTypes = playerHand.map(c => c.type);
  const beatsPlayer = aiHand.filter(c => playerTypes.some(pt => BEATS[c.type] === pt));
  const pool = beatsPlayer.length > 0 ? beatsPlayer : aiHand;
  return pool.reduce((best, c) => c.atk > best.atk ? c : best, pool[0]);
}

// ===== 컴포넌트 =====
export default function CardBattle({ user, onBack }) {
  const [stage, setStage] = useState('faction'); // faction | battle | result
  const [faction, setFaction] = useState(null);
  const [playerCards, setPlayerCards] = useState([]);
  const [enemyCards, setEnemyCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [revealedPair, setRevealedPair] = useState(null); // {player, enemy, pDmg, eDmg, winner}
  const [round, setRound] = useState(1);
  const [result, setResult] = useState(null); // 'win' | 'lose' | 'draw'
  const [shake, setShake] = useState(null); // 'player' | 'enemy' | null
  const turnLockRef = useRef(false);

  const startBattle = (chosenFaction) => {
    setFaction(chosenFaction);
    const player = CARDS[chosenFaction].map(c => ({ ...c, currentHp: c.hp }));
    const enemyFaction = chosenFaction === 'blackswan' ? 'neverseen' : 'blackswan';
    const enemy = CARDS[enemyFaction].map(c => ({ ...c, currentHp: c.hp }));
    setPlayerCards(player);
    setEnemyCards(enemy);
    setSelectedCardId(null);
    setRevealedPair(null);
    setRound(1);
    setResult(null);
    setStage('battle');
  };

  const playCard = (cardId) => {
    if (turnLockRef.current || revealedPair) return;
    const playerCard = playerCards.find(c => c.id === cardId);
    if (!playerCard || playerCard.currentHp <= 0) return;
    turnLockRef.current = true;
    setSelectedCardId(cardId);

    // AI 선택 (살아있는 카드 중)
    const aiAlive = enemyCards.filter(c => c.currentHp > 0);
    const playerAlive = playerCards.filter(c => c.currentHp > 0);
    const enemyCard = aiPickCard(aiAlive, playerAlive);

    // 1초 후 결과 공개
    setTimeout(() => {
      const { pDmg, eDmg } = resolveBattle(playerCard, enemyCard);
      const winner = pDmg < eDmg ? 'player' : pDmg > eDmg ? 'enemy' : 'draw';
      setRevealedPair({ player: playerCard, enemy: enemyCard, pDmg, eDmg, winner });
      setShake(winner === 'player' ? 'enemy' : winner === 'enemy' ? 'player' : null);

      // 데미지 적용
      setTimeout(() => {
        setPlayerCards(prev => prev.map(c => c.id === playerCard.id ? { ...c, currentHp: Math.max(0, c.currentHp - pDmg) } : c));
        setEnemyCards(prev => prev.map(c => c.id === enemyCard.id ? { ...c, currentHp: Math.max(0, c.currentHp - eDmg) } : c));
        setShake(null);
      }, 600);

      // 다음 턴
      setTimeout(() => {
        setRevealedPair(null);
        setSelectedCardId(null);
        setRound(r => r + 1);
        turnLockRef.current = false;
      }, 2400);
    }, 900);
  };

  // 게임 종료 체크
  useEffect(() => {
    if (stage !== 'battle' || revealedPair || turnLockRef.current) return;
    const pAlive = playerCards.filter(c => c.currentHp > 0).length;
    const eAlive = enemyCards.filter(c => c.currentHp > 0).length;
    if (pAlive === 0 && eAlive === 0) {
      setResult('draw');
      setStage('result');
    } else if (pAlive === 0) {
      setResult('lose');
      setStage('result');
    } else if (eAlive === 0) {
      setResult('win');
      setStage('result');
    }
  }, [playerCards, enemyCards, stage, revealedPair]);

  // 결과 진입 시 XP 요청
  useEffect(() => {
    if (stage !== 'result' || !result) return;
    const xp = result === 'win' ? 50 : result === 'draw' ? 20 : 10;
    socket.emit('card-battle-result', { nickname: user.nickname, result, xp });
  }, [stage, result, user.nickname]);

  // ===== 렌더 =====
  if (stage === 'faction') {
    return (
      <div className="cb-screen">
        <div className="cb-header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>⚔️ 잃도수 카드 배틀</h2>
        </div>
        <div className="cb-intro">
          <p className="cb-intro-line">진영을 골라 5장의 카드로 1:1 배틀!</p>
          <p className="cb-intro-line cb-faint">
            🔥불 → 🌿자연 → 💧물 → 🧠정신 → 🔥 (순환 상성)
          </p>
        </div>
        <div className="cb-faction-row">
          {Object.entries(FACTION_INFO).map(([key, info]) => (
            <button
              key={key}
              className="cb-faction-card"
              style={{ borderColor: info.color, boxShadow: `0 0 24px ${info.color}33` }}
              onClick={() => startBattle(key)}
            >
              <div className="cb-faction-emoji">{info.emoji}</div>
              <div className="cb-faction-name" style={{ color: info.color }}>{info.name}</div>
              <div className="cb-faction-desc">{info.desc}</div>
              <div className="cb-faction-cards">
                {CARDS[key].map(c => (
                  <span key={c.id} className="cb-mini-card" title={c.name}>{c.emoji}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'result') {
    const resultText = result === 'win' ? '🏆 승리!' : result === 'lose' ? '💀 패배...' : '🤝 무승부';
    const xp = result === 'win' ? 50 : result === 'draw' ? 20 : 10;
    return (
      <div className="cb-screen">
        <div className="cb-result">
          <div className={`cb-result-title cb-${result}`}>{resultText}</div>
          <div className="cb-result-xp">+{xp} XP</div>
          <div className="cb-result-btns">
            <button className="cb-btn-primary" onClick={() => setStage('faction')}>다시 하기</button>
            <button className="cb-btn-secondary" onClick={onBack}>나가기</button>
          </div>
        </div>
      </div>
    );
  }

  // battle
  return (
    <div className="cb-screen cb-battle-bg">
      <div className="cb-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>Round {round}</h2>
        <span className="cb-faction-tag" style={{ color: FACTION_INFO[faction].color }}>
          {FACTION_INFO[faction].emoji} {FACTION_INFO[faction].name}
        </span>
      </div>

      {/* 적군 카드 (위) - 항상 공개 */}
      <div className={`cb-row cb-row-enemy ${shake === 'enemy' ? 'cb-shake' : ''}`}>
        {enemyCards.map(c => (
          <CardView
            key={c.id}
            card={c}
            faceDown={false}
            highlight={revealedPair && revealedPair.enemy.id === c.id}
            dimmed={c.currentHp <= 0}
          />
        ))}
      </div>

      {/* 중앙 vs */}
      <div className="cb-vs-area">
        {revealedPair && (
          <div className="cb-vs-text">
            {revealedPair.winner === 'player' && '✨ 상성 승리!'}
            {revealedPair.winner === 'enemy' && '💥 상성 패배...'}
            {revealedPair.winner === 'draw' && '⚡ 양쪽 데미지!'}
          </div>
        )}
        {!revealedPair && !turnLockRef.current && (
          <div className="cb-pick-hint">⬇️ 카드를 골라 공격하세요</div>
        )}
      </div>

      {/* 내 카드 (아래) */}
      <div className={`cb-row cb-row-player ${shake === 'player' ? 'cb-shake' : ''}`}>
        {playerCards.map(c => (
          <CardView
            key={c.id}
            card={c}
            faceDown={false}
            highlight={selectedCardId === c.id}
            dimmed={c.currentHp <= 0}
            onClick={() => !revealedPair && c.currentHp > 0 && playCard(c.id)}
            interactive={!revealedPair && c.currentHp > 0}
          />
        ))}
      </div>
    </div>
  );
}

function CardView({ card, faceDown, highlight, dimmed, onClick, interactive }) {
  const t = TYPES[card.type];
  const hpPct = (card.currentHp / card.hp) * 100;
  return (
    <div
      className={`cb-card ${highlight ? 'cb-highlight' : ''} ${dimmed ? 'cb-dimmed' : ''} ${interactive ? 'cb-interactive' : ''}`}
      style={{ background: faceDown ? 'linear-gradient(135deg,#1a1a3a,#0a0a1a)' : card.bg }}
      onClick={onClick}
    >
      {faceDown ? (
        <div className="cb-card-back">⚜️</div>
      ) : (
        <>
          <div className="cb-card-top">
            <span className="cb-card-type" style={{ background: t.color }}>{t.emoji}</span>
            <span className="cb-card-atk">⚔️{card.atk}</span>
          </div>
          <div className="cb-card-emoji">{card.emoji}</div>
          <div className="cb-card-name">{card.name}</div>
          <div className="cb-card-desc">{card.desc}</div>
          <div className="cb-card-hp">
            <div className="cb-card-hp-fill" style={{ width: `${hpPct}%`, background: hpPct > 50 ? '#4cd964' : hpPct > 20 ? '#ffcc00' : '#ff3b30' }} />
            <span className="cb-card-hp-text">{card.currentHp}/{card.hp}</span>
          </div>
        </>
      )}
    </div>
  );
}
