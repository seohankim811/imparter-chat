import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

// ===== 타입 시스템 =====
const TYPES = {
  fire:   { emoji: '🔥', name: '불',   color: '#ff5e3a' },
  nature: { emoji: '🌿', name: '자연', color: '#3acb6e' },
  water:  { emoji: '💧', name: '물',   color: '#3aa6ff' },
  mind:   { emoji: '🧠', name: '정신', color: '#c46aff' }
};
// 누가 누구 이김: A → BEATS[A] (A가 BEATS[A]를 이김)
const BEATS = { fire: 'nature', nature: 'water', water: 'mind', mind: 'fire' };

// ===== 카드 데이터 =====
// cost: 마나, atk: 공격력, hp: 체력, ability: 등장 효과 (battlecry)
const CARDS = {
  blackswan: [
    { id: 'sophie',   name: 'Sophie Foster',  emoji: '🌙', type: 'mind',   cost: 4, atk: 4, hp: 5, ability: 'random_dmg_3', abilityText: '등장: 적 카드 1장에 3 데미지' },
    { id: 'keefe',    name: 'Keefe Sencen',   emoji: '😏', type: 'nature', cost: 3, atk: 3, hp: 4, ability: 'heal_4',       abilityText: '등장: 리더 4 회복' },
    { id: 'fitz',     name: 'Fitz Vacker',    emoji: '🎩', type: 'mind',   cost: 3, atk: 3, hp: 3, ability: 'draw_1',       abilityText: '등장: 카드 1장 드로우' },
    { id: 'biana',    name: 'Biana Vacker',   emoji: '👻', type: 'water',  cost: 2, atk: 3, hp: 2, ability: 'stealth',      abilityText: '은신: 다음 턴까지 공격 못 받음' },
    { id: 'dex',      name: 'Dex Dizznee',    emoji: '🔧', type: 'nature', cost: 2, atk: 2, hp: 3, ability: 'mana_1',       abilityText: '등장: 현재 마나 +1' },
    { id: 'grady',    name: 'Grady Ruewen',   emoji: '👨‍🦰', type: 'mind',   cost: 5, atk: 5, hp: 5, ability: null,           abilityText: '' },
    { id: 'edaline',  name: 'Edaline',        emoji: '👩‍🦰', type: 'nature', cost: 4, atk: 2, hp: 5, ability: 'heal_per_turn', abilityText: '턴 끝: 리더 2 회복' },
    { id: 'tiergan',  name: 'Tiergan',        emoji: '🧙', type: 'mind',   cost: 4, atk: 4, hp: 4, ability: 'silence',      abilityText: '등장: 적 카드 능력 침묵' }
  ],
  neverseen: [
    { id: 'fintan',   name: 'Fintan Pyren',   emoji: '🔥', type: 'fire',   cost: 5, atk: 5, hp: 5, ability: 'aoe_2',        abilityText: '등장: 모든 적 카드 2 데미지' },
    { id: 'brant',    name: 'Brant',          emoji: '👨‍🦱', type: 'fire',   cost: 3, atk: 3, hp: 3, ability: 'random_dmg_2', abilityText: '등장: 적 카드 1장에 2 데미지' },
    { id: 'vespera',  name: 'Vespera',        emoji: '🦂', type: 'mind',   cost: 5, atk: 4, hp: 5, ability: 'inflict',      abilityText: '등장: 턴 끝마다 적 리더 1 데미지' },
    { id: 'gethen',   name: 'Gethen',         emoji: '🕴️', type: 'mind',   cost: 4, atk: 4, hp: 4, ability: 'draw_1',       abilityText: '등장: 카드 1장 드로우' },
    { id: 'ruy',      name: 'Ruy Ignis',      emoji: '💎', type: 'water',  cost: 3, atk: 2, hp: 4, ability: 'phaser',       abilityText: '페이저: 50% 회피 (1회)' },
    { id: 'umber',    name: 'Umber',          emoji: '🌑', type: 'mind',   cost: 3, atk: 3, hp: 3, ability: 'stealth',      abilityText: '은신: 다음 턴까지 공격 못 받음' },
    { id: 'trix',     name: 'Trix',           emoji: '✨', type: 'water',  cost: 2, atk: 2, hp: 2, ability: null,           abilityText: '' },
    { id: 'gisela',   name: 'Lady Gisela',    emoji: '👑', type: 'mind',   cost: 6, atk: 6, hp: 6, ability: 'face_dmg_3',   abilityText: '등장: 적 리더 3 데미지' }
  ]
};

const FACTION_INFO = {
  blackswan: { name: '블랙스완',           emoji: '🌹', desc: 'Sophie와 친구들',   color: '#4bd1a8' },
  neverseen: { name: '마티치 (Neverseen)', emoji: '🖤', desc: 'Fintan과 추종자들', color: '#d14b4b' }
};

// ===== 유틸 =====
let __cardUid = 0;
function uid() { return `c${++__cardUid}`; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function instantiate(template) {
  return {
    ...template,
    uid: uid(),
    currentHp: template.hp,
    canAttack: false, // 등장한 턴엔 못 침 (Hearthstone Summoning Sickness)
    stealth: template.ability === 'stealth',
    phaserCharged: template.ability === 'phaser',
    silenced: false
  };
}

const LEADER_MAX = 30;
const FIELD_MAX = 4;
const HAND_MAX = 7;
const STARTING_HAND = 3;
const MAX_MANA = 10;

// ===== 메인 컴포넌트 =====
export default function CardBattle({ user, onBack }) {
  const [stage, setStage] = useState('faction');
  const [faction, setFaction] = useState(null);

  // 게임 상태
  const [state, setState] = useState(null);
  const [log, setLog] = useState([]);
  const [pendingTarget, setPendingTarget] = useState(null); // { attackerUid }
  const [animQueue, setAnimQueue] = useState([]);
  const aiTurnLockRef = useRef(false);

  const pushLog = useCallback((text) => {
    setLog(l => [...l.slice(-7), { id: Date.now() + Math.random(), text }]);
  }, []);

  const startBattle = (chosenFaction) => {
    setFaction(chosenFaction);
    const playerDeck = shuffle(CARDS[chosenFaction].map(instantiate));
    const enemyFaction = chosenFaction === 'blackswan' ? 'neverseen' : 'blackswan';
    const enemyDeck = shuffle(CARDS[enemyFaction].map(instantiate));
    const playerHand = playerDeck.splice(0, STARTING_HAND);
    const enemyHand = enemyDeck.splice(0, STARTING_HAND);
    setState({
      player: {
        leaderHp: LEADER_MAX,
        mana: 1,
        maxMana: 1,
        deck: playerDeck,
        hand: playerHand,
        field: [],
        burnPerTurn: 0
      },
      enemy: {
        leaderHp: LEADER_MAX,
        mana: 1,
        maxMana: 1,
        deck: enemyDeck,
        hand: enemyHand,
        field: [],
        burnPerTurn: 0
      },
      turn: 'player',
      turnCount: 1,
      gameOver: null
    });
    setLog([{ id: Date.now(), text: '⚔️ 배틀 시작!' }]);
    setStage('battle');
  };

  // ===== 게임 로직 =====
  // 능력 적용 — 순수 함수: { state, logs } 반환
  const applyBattlecry = (state, side, playedCard) => {
    const logs = [];
    if (!playedCard.ability || playedCard.silenced) {
      return { state, logs };
    }
    const opp = side === 'player' ? 'enemy' : 'player';
    let s = { ...state };
    const aliveEnemies = s[opp].field.filter(c => c.currentHp > 0);

    switch (playedCard.ability) {
      case 'random_dmg_3':
      case 'random_dmg_2': {
        const dmg = playedCard.ability === 'random_dmg_3' ? 3 : 2;
        if (aliveEnemies.length > 0) {
          const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
          s[opp] = {
            ...s[opp],
            field: s[opp].field.map(c => c.uid === target.uid ? { ...c, currentHp: c.currentHp - dmg } : c)
          };
          logs.push(`${playedCard.emoji} ${playedCard.name} → ${target.emoji} ${target.name}에 ${dmg} 데미지`);
        }
        break;
      }
      case 'aoe_2': {
        s[opp] = {
          ...s[opp],
          field: s[opp].field.map(c => ({ ...c, currentHp: c.currentHp - 2 }))
        };
        if (aliveEnemies.length > 0) logs.push(`${playedCard.emoji} ${playedCard.name}: 모든 적 카드 2 데미지`);
        break;
      }
      case 'heal_4': {
        s[side] = { ...s[side], leaderHp: Math.min(LEADER_MAX, s[side].leaderHp + 4) };
        logs.push(`💚 ${playedCard.name}: 리더 4 회복`);
        break;
      }
      case 'draw_1': {
        if (s[side].deck.length > 0 && s[side].hand.length < HAND_MAX) {
          const [drawn, ...rest] = s[side].deck;
          s[side] = { ...s[side], deck: rest, hand: [...s[side].hand, drawn] };
          logs.push(`🃏 ${playedCard.name}: 카드 드로우`);
        }
        break;
      }
      case 'mana_1': {
        s[side] = { ...s[side], mana: Math.min(MAX_MANA, s[side].mana + 1) };
        logs.push(`💎 ${playedCard.name}: 현재 마나 +1`);
        break;
      }
      case 'face_dmg_3': {
        s[opp] = { ...s[opp], leaderHp: s[opp].leaderHp - 3 };
        logs.push(`🎯 ${playedCard.name}: 적 리더 3 데미지`);
        break;
      }
      case 'silence': {
        if (aliveEnemies.length > 0) {
          const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
          s[opp] = {
            ...s[opp],
            field: s[opp].field.map(c => c.uid === target.uid ? { ...c, silenced: true, stealth: false } : c)
          };
          logs.push(`🤫 ${playedCard.name}: ${target.name} 침묵`);
        }
        break;
      }
      case 'inflict': {
        s[opp] = { ...s[opp], burnPerTurn: (s[opp].burnPerTurn || 0) + 1 };
        logs.push(`☠️ ${playedCard.name}: 적 리더에 인플릭트 부여`);
        break;
      }
      default: break;
    }

    // 죽은 카드 정리
    s.player = { ...s.player, field: s.player.field.filter(c => c.currentHp > 0) };
    s.enemy = { ...s.enemy, field: s.enemy.field.filter(c => c.currentHp > 0) };
    return { state: s, logs };
  };

  // 한 번에 상태 + 로그 적용 (StrictMode-safe)
  const flushLogs = (logs) => {
    if (!logs || logs.length === 0) return;
    setLog(l => {
      const newEntries = logs.map((t, i) => ({ id: Date.now() + Math.random() + i, text: t }));
      return [...l.slice(-7), ...newEntries];
    });
  };

  // 카드를 손에서 필드로 — side: 'player' | 'enemy'
  const playCardFromHand = (side, cardUid) => {
    const cur = stateRef.current;
    if (!cur || cur.gameOver) return;
    const p = cur[side];
    const card = p.hand.find(c => c.uid === cardUid);
    if (!card) return;
    if (p.mana < card.cost) {
      flushLogs(['💔 마나가 부족해요']);
      return;
    }
    if (p.field.length >= FIELD_MAX) {
      flushLogs(['💔 필드가 꽉 찼어요']);
      return;
    }
    const playedCard = { ...card, canAttack: false };
    let s2 = {
      ...cur,
      [side]: {
        ...p,
        mana: p.mana - card.cost,
        hand: p.hand.filter(c => c.uid !== cardUid),
        field: [...p.field, playedCard]
      }
    };
    const battlecry = applyBattlecry(s2, side, playedCard);
    s2 = battlecry.state;
    setState(s2);
    flushLogs([
      `${side === 'player' ? '🟢' : '🔴'} ${card.emoji} ${card.name} 등장 (cost ${card.cost})`,
      ...battlecry.logs
    ]);
  };

  // 공격: 공격자(side의 카드) → 대상 (opp의 카드 or 'face')
  const performAttack = (side, attackerUid, target) => {
    const cur = stateRef.current;
    if (!cur || cur.gameOver) return;
    const opp = side === 'player' ? 'enemy' : 'player';
    const attacker = cur[side].field.find(c => c.uid === attackerUid);
    if (!attacker || !attacker.canAttack || attacker.currentHp <= 0) return;

    const logs = [];
    let s2 = { ...cur };
    if (target === 'face') {
      const dmg = attacker.atk;
      s2[opp] = { ...s2[opp], leaderHp: Math.max(0, s2[opp].leaderHp - dmg) };
      logs.push(`⚔️ ${attacker.name} → 리더 ${dmg} 데미지`);
      s2[side] = {
        ...s2[side],
        field: s2[side].field.map(c => c.uid === attackerUid ? { ...c, canAttack: false } : c)
      };
    } else {
      const defender = cur[opp].field.find(c => c.uid === target);
      if (!defender) return;
      if (defender.stealth) {
        flushLogs([`👻 ${defender.name}은 은신 중! 공격 불가`]);
        return;
      }
      // 페이저 회피
      if (defender.phaserCharged && Math.random() < 0.5) {
        logs.push(`✨ ${defender.name} 페이저 회피!`);
        s2[opp] = {
          ...s2[opp],
          field: s2[opp].field.map(c => c.uid === defender.uid ? { ...c, phaserCharged: false } : c)
        };
        s2[side] = {
          ...s2[side],
          field: s2[side].field.map(c => c.uid === attackerUid ? { ...c, canAttack: false } : c)
        };
        setState(s2);
        flushLogs(logs);
        return;
      }
      // 타입 상성: 공격자 타입이 방어자 타입을 이기면 +2 데미지
      const advBonus = BEATS[attacker.type] === defender.type ? 2 : 0;
      const disadv = BEATS[defender.type] === attacker.type ? -1 : 0;
      const atkToDef = attacker.atk + advBonus + disadv;
      const defToAtk = defender.atk;
      logs.push(`⚔️ ${attacker.name} ↔ ${defender.name}${advBonus ? ' (상성+!)' : disadv ? ' (상성-)' : ''}`);
      s2[side] = {
        ...s2[side],
        field: s2[side].field.map(c => c.uid === attackerUid ? { ...c, canAttack: false, currentHp: c.currentHp - defToAtk } : c)
      };
      s2[opp] = {
        ...s2[opp],
        field: s2[opp].field.map(c => c.uid === defender.uid ? { ...c, currentHp: c.currentHp - atkToDef } : c)
      };
      // 죽은 카드 정리
      s2.player = { ...s2.player, field: s2.player.field.filter(c => c.currentHp > 0) };
      s2.enemy = { ...s2.enemy, field: s2.enemy.field.filter(c => c.currentHp > 0) };
    }
    setState(s2);
    flushLogs(logs);
  };

  // endTurn: 현 턴 종료 효과 적용 → 턴 전환 → 새 턴 셋업 (드로우/마나/공격권)
  const endTurn = () => {
    const cur = stateRef.current;
    if (!cur || cur.gameOver) return;
    const curSide = cur.turn;
    const nextSide = curSide === 'player' ? 'enemy' : 'player';
    const logs = [];
    let s2 = { ...cur };

    // 1. 턴 끝 효과: heal_per_turn
    const healAmt = s2[curSide].field.filter(c => c.ability === 'heal_per_turn' && !c.silenced && c.currentHp > 0).length * 2;
    if (healAmt > 0) {
      s2[curSide] = { ...s2[curSide], leaderHp: Math.min(LEADER_MAX, s2[curSide].leaderHp + healAmt) };
      logs.push(`💚 ${curSide === 'player' ? '내' : '적'} 리더 ${healAmt} 회복 (Edaline)`);
    }

    // 2. 새 턴 시작
    const newMax = Math.min(MAX_MANA, s2[nextSide].maxMana + 1);
    const burn = s2[nextSide].burnPerTurn || 0;
    s2[nextSide] = {
      ...s2[nextSide],
      leaderHp: Math.max(0, s2[nextSide].leaderHp - burn),
      maxMana: newMax,
      mana: newMax,
      field: s2[nextSide].field.map(c => ({ ...c, canAttack: true, stealth: false }))
    };
    if (burn > 0) logs.push(`☠️ ${nextSide === 'player' ? '내' : '적'} 리더가 인플릭트로 ${burn} 데미지`);

    // 3. 드로우
    if (s2[nextSide].deck.length > 0 && s2[nextSide].hand.length < HAND_MAX) {
      const [drawn, ...rest] = s2[nextSide].deck;
      s2[nextSide] = { ...s2[nextSide], deck: rest, hand: [...s2[nextSide].hand, drawn] };
    }

    setState({ ...s2, turn: nextSide, turnCount: cur.turnCount + 1 });
    flushLogs(logs);
  };

  // 적 턴 자동 진행
  useEffect(() => {
    if (!state || state.gameOver) return;
    if (state.turn !== 'enemy') return;
    if (aiTurnLockRef.current) return;
    aiTurnLockRef.current = true;

    const runAiTurn = async () => {
      // AI: 최대한 카드 내고, 공격할 수 있는 거 다 공격
      await new Promise(r => setTimeout(r, 800));

      // 카드 내기 (가장 비싼 것부터)
      let safety = 0;
      while (safety++ < 10) {
        const cur = stateRef.current;
        if (!cur || cur.turn !== 'enemy' || cur.gameOver) break;
        const playable = cur.enemy.hand
          .filter(c => c.cost <= cur.enemy.mana)
          .sort((a, b) => b.cost - a.cost);
        if (playable.length === 0 || cur.enemy.field.length >= FIELD_MAX) break;
        playCardFromHand('enemy', playable[0].uid);
        await new Promise(r => setTimeout(r, 700));
      }

      // 공격
      safety = 0;
      while (safety++ < 10) {
        const cur = stateRef.current;
        if (!cur || cur.turn !== 'enemy' || cur.gameOver) break;
        const attackers = cur.enemy.field.filter(c => c.canAttack && c.currentHp > 0);
        if (attackers.length === 0) break;

        const attacker = attackers[0];
        const targets = cur.player.field.filter(c => !c.stealth && c.currentHp > 0);
        // 우선: 상성 우위 카드, 없으면 face 직접 공격
        let target;
        const advTargets = targets.filter(d => BEATS[attacker.type] === d.type);
        if (advTargets.length > 0) {
          target = advTargets[0].uid;
        } else if (targets.length > 0 && cur.player.leaderHp > attacker.atk * 2) {
          target = targets[0].uid;
        } else {
          target = 'face';
        }
        performAttack('enemy', attacker.uid, target);
        await new Promise(r => setTimeout(r, 600));
      }

      await new Promise(r => setTimeout(r, 400));
      endTurn();
      aiTurnLockRef.current = false;
    };
    runAiTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turn]);

  // state 최신값 ref
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // 게임 종료 체크
  useEffect(() => {
    if (!state || state.gameOver) return;
    if (state.player.leaderHp <= 0 && state.enemy.leaderHp <= 0) {
      setState(s => ({ ...s, gameOver: 'draw' }));
    } else if (state.player.leaderHp <= 0) {
      setState(s => ({ ...s, gameOver: 'lose' }));
    } else if (state.enemy.leaderHp <= 0) {
      setState(s => ({ ...s, gameOver: 'win' }));
    }
  }, [state?.player?.leaderHp, state?.enemy?.leaderHp]); // eslint-disable-line

  // 결과 화면으로 자동 전환
  useEffect(() => {
    if (state?.gameOver) {
      const result = state.gameOver;
      const xp = result === 'win' ? 50 : result === 'draw' ? 20 : 10;
      socket.emit('card-battle-result', { nickname: user.nickname, result, xp });
      setTimeout(() => setStage('result'), 1200);
    }
  }, [state?.gameOver, user.nickname]);

  // ===== 사용자 액션 =====
  const onClickHandCard = (cardUid) => {
    if (!state || state.turn !== 'player' || state.gameOver) return;
    playCardFromHand('player', cardUid);
  };

  const onClickFieldCard = (cardUid, side) => {
    if (!state || state.turn !== 'player' || state.gameOver) return;
    if (side === 'player') {
      // 내 필드 카드 클릭 = 공격자 선택 (또는 토글)
      const card = state.player.field.find(c => c.uid === cardUid);
      if (!card || !card.canAttack) return;
      if (pendingTarget?.attackerUid === cardUid) {
        setPendingTarget(null);
      } else {
        setPendingTarget({ attackerUid: cardUid });
      }
    } else {
      // 적 필드 카드 클릭 = 공격 대상
      if (!pendingTarget) return;
      performAttack('player', pendingTarget.attackerUid, cardUid);
      setPendingTarget(null);
    }
  };

  const onClickEnemyFace = () => {
    if (!state || state.turn !== 'player' || state.gameOver) return;
    if (!pendingTarget) return;
    performAttack('player', pendingTarget.attackerUid, 'face');
    setPendingTarget(null);
  };

  // ===== 렌더 =====
  if (stage === 'faction') {
    return (
      <div className="cb-screen">
        <div className="cb-header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>⚔️ 잃도수 카드 배틀</h2>
        </div>
        <div className="cb-intro">
          <p className="cb-intro-line">진영을 골라 카드 배틀!</p>
          <p className="cb-intro-line cb-faint">리더 30 HP · 마나 시스템 · 특수 능력 · 타입 상성</p>
          <p className="cb-intro-line cb-faint">🔥불 → 🌿자연 → 💧물 → 🧠정신 → 🔥</p>
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
                  <span key={c.id} className="cb-mini-card" title={`${c.name} ${TYPES[c.type].emoji}`}>{c.emoji}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'result') {
    const result = state?.gameOver;
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

  if (!state) return null;

  // ===== 배틀 화면 =====
  return (
    <div className="cb-screen cb-battle-bg">
      <div className="cb-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>Turn {state.turnCount} · {state.turn === 'player' ? '내 차례' : '적 차례'}</h2>
        <span className="cb-faction-tag" style={{ color: FACTION_INFO[faction].color }}>
          {FACTION_INFO[faction].emoji}
        </span>
      </div>

      {/* 적 리더 */}
      <div className="cb-leader cb-leader-enemy" onClick={onClickEnemyFace}>
        <div className="cb-leader-info">
          <span className="cb-leader-emoji">{FACTION_INFO[faction === 'blackswan' ? 'neverseen' : 'blackswan'].emoji}</span>
          <span className="cb-leader-name">적 리더</span>
        </div>
        <div className="cb-leader-stats">
          <span className="cb-leader-hp">❤️ {state.enemy.leaderHp}/{LEADER_MAX}</span>
          <span className="cb-leader-mana">💎 {state.enemy.mana}/{state.enemy.maxMana}</span>
          <span className="cb-leader-deck">🃏 {state.enemy.deck.length}/{state.enemy.hand.length}</span>
        </div>
        {pendingTarget && <span className="cb-target-badge">🎯 클릭해 공격</span>}
      </div>

      {/* 적 손 (개수만) */}
      <div className="cb-row cb-hand-enemy">
        {state.enemy.hand.map((c, i) => (
          <div key={i} className="cb-card cb-card-back-mini" />
        ))}
      </div>

      {/* 적 필드 */}
      <div className="cb-field cb-field-enemy">
        {state.enemy.field.length === 0 && <div className="cb-field-empty">적 필드 비어있음</div>}
        {state.enemy.field.map(c => (
          <CardView
            key={c.uid}
            card={c}
            onClick={() => onClickFieldCard(c.uid, 'enemy')}
            interactive={!!pendingTarget && !c.stealth}
            targetable={!!pendingTarget && !c.stealth}
          />
        ))}
      </div>

      {/* 가운데 구분선 + 로그 */}
      <div className="cb-mid">
        <div className="cb-log">
          {log.slice(-3).map(l => <div key={l.id} className="cb-log-line">{l.text}</div>)}
        </div>
      </div>

      {/* 내 필드 */}
      <div className="cb-field cb-field-player">
        {state.player.field.length === 0 && <div className="cb-field-empty">내 필드 비어있음 — 카드를 내세요</div>}
        {state.player.field.map(c => (
          <CardView
            key={c.uid}
            card={c}
            highlight={pendingTarget?.attackerUid === c.uid}
            onClick={() => onClickFieldCard(c.uid, 'player')}
            interactive={state.turn === 'player' && c.canAttack}
            readyToAttack={c.canAttack && state.turn === 'player'}
          />
        ))}
      </div>

      {/* 내 리더 */}
      <div className="cb-leader cb-leader-player">
        <div className="cb-leader-info">
          <span className="cb-leader-emoji">{FACTION_INFO[faction].emoji}</span>
          <span className="cb-leader-name">{user.nickname}</span>
        </div>
        <div className="cb-leader-stats">
          <span className="cb-leader-hp">❤️ {state.player.leaderHp}/{LEADER_MAX}</span>
          <span className="cb-leader-mana">💎 {state.player.mana}/{state.player.maxMana}</span>
          <span className="cb-leader-deck">🃏 {state.player.deck.length}</span>
        </div>
        {state.turn === 'player' && !state.gameOver && (
          <button className="cb-end-turn" onClick={endTurn}>End Turn ▶</button>
        )}
      </div>

      {/* 내 손 */}
      <div className="cb-hand-player">
        {state.player.hand.map(c => (
          <CardView
            key={c.uid}
            card={c}
            isInHand
            playable={state.turn === 'player' && state.player.mana >= c.cost && state.player.field.length < FIELD_MAX}
            onClick={() => onClickHandCard(c.uid)}
            interactive={state.turn === 'player' && state.player.mana >= c.cost && state.player.field.length < FIELD_MAX}
          />
        ))}
      </div>
    </div>
  );
}

// ===== 카드 뷰 =====
function CardView({ card, highlight, dimmed, onClick, interactive, isInHand, playable, readyToAttack, targetable }) {
  const t = TYPES[card.type];
  const hpPct = (card.currentHp / card.hp) * 100;
  const cls = [
    'cb-card',
    isInHand ? 'cb-card-hand' : 'cb-card-field',
    highlight ? 'cb-highlight' : '',
    dimmed ? 'cb-dimmed' : '',
    interactive ? 'cb-interactive' : '',
    isInHand && playable ? 'cb-playable' : '',
    isInHand && !playable ? 'cb-unplayable' : '',
    readyToAttack ? 'cb-ready' : '',
    targetable ? 'cb-targetable' : '',
    card.stealth ? 'cb-stealth' : '',
    card.silenced ? 'cb-silenced' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={onClick} title={card.abilityText}>
      <div className="cb-card-frame" style={{ borderColor: t.color }}>
        <div className="cb-card-top">
          <span className="cb-card-cost">💎{card.cost}</span>
          <span className="cb-card-type" style={{ background: t.color }}>{t.emoji}</span>
        </div>
        <div className="cb-card-emoji">{card.emoji}</div>
        <div className="cb-card-name">{card.name}</div>
        {card.abilityText && <div className="cb-card-ability">{card.abilityText}</div>}
        <div className="cb-card-stats">
          <span className="cb-card-atk">⚔️ {card.atk}</span>
          <span className="cb-card-hp-num" style={{ color: hpPct > 50 ? '#4cd964' : hpPct > 20 ? '#ffcc00' : '#ff3b30' }}>
            ❤️ {card.currentHp}/{card.hp}
          </span>
        </div>
      </div>
      {card.stealth && <div className="cb-badge cb-badge-stealth">👻 은신</div>}
      {card.silenced && <div className="cb-badge cb-badge-silenced">🤫 침묵</div>}
    </div>
  );
}
