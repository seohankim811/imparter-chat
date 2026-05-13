import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

// ===== 타입 시스템 =====
const TYPES = {
  fire:   { emoji: '🔥', name: '불',   color: '#ff5e3a' },
  nature: { emoji: '🌿', name: '자연', color: '#3acb6e' },
  water:  { emoji: '💧', name: '물',   color: '#3aa6ff' },
  mind:   { emoji: '🧠', name: '정신', color: '#c46aff' }
};
const BEATS = { fire: 'nature', nature: 'water', water: 'mind', mind: 'fire' };

// ===== 카드 데이터 =====
// cost: 마나, atk: 공격력, hp: 체력, ability: 등장 효과
const CARDS = {
  blackswan: [
    { id: 'sophie',   name: 'Sophie Foster',  emoji: '🌙', type: 'mind',   cost: 4, atk: 4, hp: 5, ability: 'random_dmg_3', abilityText: '등장: 적 카드 1장에 3 데미지' },
    { id: 'keefe',    name: 'Keefe Sencen',   emoji: '😏', type: 'nature', cost: 3, atk: 3, hp: 4, ability: 'heal_4',       abilityText: '등장: 리더 4 회복' },
    { id: 'fitz',     name: 'Fitz Vacker',    emoji: '🎩', type: 'mind',   cost: 3, atk: 3, hp: 3, ability: 'mana_1',       abilityText: '등장: 마나 +1' },
    { id: 'biana',    name: 'Biana Vacker',   emoji: '👻', type: 'water',  cost: 2, atk: 3, hp: 2, ability: 'stealth',      abilityText: '은신: 3초간 공격 못 받음' },
    { id: 'dex',      name: 'Dex Dizznee',    emoji: '🔧', type: 'nature', cost: 2, atk: 2, hp: 3, ability: 'mana_1',       abilityText: '등장: 마나 +1' },
    { id: 'grady',    name: 'Grady Ruewen',   emoji: '👨‍🦰', type: 'mind',   cost: 5, atk: 5, hp: 5, ability: null,           abilityText: '강력한 텔레파시' },
    { id: 'edaline',  name: 'Edaline',        emoji: '👩‍🦰', type: 'nature', cost: 4, atk: 2, hp: 5, ability: 'heal_4',       abilityText: '등장: 리더 4 회복' },
    { id: 'tiergan',  name: 'Tiergan',        emoji: '🧙', type: 'mind',   cost: 4, atk: 4, hp: 4, ability: 'silence',      abilityText: '등장: 적 카드 능력 침묵' }
  ],
  neverseen: [
    { id: 'fintan',   name: 'Fintan Pyren',   emoji: '🔥', type: 'fire',   cost: 5, atk: 5, hp: 5, ability: 'aoe_2',        abilityText: '등장: 모든 적 카드 2 데미지' },
    { id: 'brant',    name: 'Brant',          emoji: '👨‍🦱', type: 'fire',   cost: 3, atk: 3, hp: 3, ability: 'random_dmg_2', abilityText: '등장: 적 카드 1장에 2 데미지' },
    { id: 'vespera',  name: 'Vespera',        emoji: '🦂', type: 'mind',   cost: 5, atk: 4, hp: 5, ability: 'face_dmg_3',   abilityText: '등장: 적 리더 3 데미지' },
    { id: 'gethen',   name: 'Gethen',         emoji: '🕴️', type: 'mind',   cost: 4, atk: 4, hp: 4, ability: null,           abilityText: '텔레파시' },
    { id: 'ruy',      name: 'Ruy Ignis',      emoji: '💎', type: 'water',  cost: 3, atk: 2, hp: 4, ability: 'phaser',       abilityText: '페이저: 50% 회피 (1회)' },
    { id: 'umber',    name: 'Umber',          emoji: '🌑', type: 'mind',   cost: 3, atk: 3, hp: 3, ability: 'stealth',      abilityText: '은신: 3초간 공격 못 받음' },
    { id: 'trix',     name: 'Trix',           emoji: '✨', type: 'water',  cost: 2, atk: 2, hp: 2, ability: null,           abilityText: '빠른 카드' },
    { id: 'gisela',   name: 'Lady Gisela',    emoji: '👑', type: 'mind',   cost: 6, atk: 6, hp: 6, ability: 'face_dmg_3',   abilityText: '등장: 적 리더 3 데미지' }
  ]
};

const FACTION_INFO = {
  blackswan: { name: '블랙스완',           emoji: '🌹', desc: 'Sophie와 친구들',   color: '#4bd1a8' },
  neverseen: { name: '마티치 (Neverseen)', emoji: '🖤', desc: 'Fintan과 추종자들', color: '#d14b4b' }
};

// ===== 상수 =====
const LEADER_MAX = 30;
const PLAYER_BONUS_HP = 15;      // 플레이어 시작 HP 45 (AI는 30)
const FIELD_MAX = 4;
const HAND_MAX = 7;
const STARTING_HAND = 4;
const STARTING_MANA_PLAYER = 3;  // 플레이어는 3마나로 시작 (Dex/Biana/Trix 즉시 가능)
const STARTING_MANA_ENEMY = 0;   // AI는 0부터 (느리게 시작)
const MAX_MANA = 10;
const MANA_TICK_MS_PLAYER = 1000;    // 플레이어: 1초에 1
const MANA_TICK_MS_ENEMY = 2000;     // AI: 2초에 1 (절반 속도)
const DRAW_TICK_MS = 5000;
const SUMMONING_SICKNESS_MS = 1500;
const SUMMONING_SICKNESS_MS_ENEMY = 2500; // AI 카드는 더 오래 대기
const ATTACK_COOLDOWN_MS = 1800;
const ATTACK_COOLDOWN_MS_ENEMY = 2500; // AI 공격 쿨 더 길게
const STEALTH_DURATION_MS = 3000;

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
function instantiate(template, now, side = 'player') {
  const sickness = side === 'enemy' ? SUMMONING_SICKNESS_MS_ENEMY : SUMMONING_SICKNESS_MS;
  return {
    ...template,
    uid: uid(),
    side,
    currentHp: template.hp,
    readyAt: now + sickness,
    stealthUntil: template.ability === 'stealth' ? now + STEALTH_DURATION_MS : 0,
    phaserCharged: template.ability === 'phaser',
    silenced: false
  };
}

// ===== 메인 컴포넌트 =====
export default function CardBattle({ user, onBack }) {
  const [stage, setStage] = useState('faction');
  const [faction, setFaction] = useState(null);

  const [state, setState] = useState(null);
  const [log, setLog] = useState([]);
  const [pendingTarget, setPendingTarget] = useState(null); // { attackerUid }
  const [tick, setTick] = useState(0); // 강제 리렌더용 (쿨다운/은신 시간 진행)

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ===== 로그 =====
  const flushLogs = useCallback((logs) => {
    if (!logs || logs.length === 0) return;
    setLog(l => {
      const newEntries = logs.map((t, i) => ({ id: Date.now() + Math.random() + i, text: t }));
      return [...l.slice(-8), ...newEntries];
    });
  }, []);

  // ===== 시작 =====
  const startBattle = (chosenFaction) => {
    const now = Date.now();
    setFaction(chosenFaction);
    const playerDeck = shuffle(CARDS[chosenFaction].map(c => instantiate(c, now, 'player')));
    const enemyFaction = chosenFaction === 'blackswan' ? 'neverseen' : 'blackswan';
    const enemyDeck = shuffle(CARDS[enemyFaction].map(c => instantiate(c, now, 'enemy')));
    const playerHand = playerDeck.splice(0, STARTING_HAND);
    const enemyHand = enemyDeck.splice(0, STARTING_HAND);
    setState({
      startTime: now,
      lastManaTickAtPlayer: now,
      lastManaTickAtEnemy: now,
      lastDrawTickAt: now,
      player: {
        leaderHp: LEADER_MAX + PLAYER_BONUS_HP,
        leaderHpMax: LEADER_MAX + PLAYER_BONUS_HP,
        mana: STARTING_MANA_PLAYER,
        deck: playerDeck,
        hand: playerHand,
        field: []
      },
      enemy: {
        leaderHp: LEADER_MAX,
        leaderHpMax: LEADER_MAX,
        mana: STARTING_MANA_ENEMY,
        deck: enemyDeck,
        hand: enemyHand,
        field: []
      },
      gameOver: null
    });
    setLog([{ id: Date.now(), text: '⚔️ 배틀 시작! 마나가 1초마다 차요. 카드 클릭해서 내고, 필드 카드 클릭해서 공격!' }]);
    setPendingTarget(null);
    setStage('battle');
  };

  // ===== 능력 적용 (순수) =====
  const applyBattlecry = (st, side, playedCard) => {
    const logs = [];
    if (!playedCard.ability || playedCard.silenced) return { state: st, logs };
    const opp = side === 'player' ? 'enemy' : 'player';
    let s = { ...st };
    const aliveEnemies = s[opp].field.filter(c => c.currentHp > 0);

    switch (playedCard.ability) {
      case 'random_dmg_3':
      case 'random_dmg_2': {
        const dmg = playedCard.ability === 'random_dmg_3' ? 3 : 2;
        if (aliveEnemies.length > 0) {
          const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
          s[opp] = { ...s[opp], field: s[opp].field.map(c => c.uid === target.uid ? { ...c, currentHp: c.currentHp - dmg } : c) };
          logs.push(`${playedCard.emoji} ${playedCard.name} → ${target.name}에 ${dmg} 데미지`);
        }
        break;
      }
      case 'aoe_2': {
        s[opp] = { ...s[opp], field: s[opp].field.map(c => ({ ...c, currentHp: c.currentHp - 2 })) };
        if (aliveEnemies.length > 0) logs.push(`${playedCard.emoji} ${playedCard.name}: 모든 적 카드 2 데미지`);
        break;
      }
      case 'heal_4': {
        const maxHp = s[side].leaderHpMax || LEADER_MAX;
        s[side] = { ...s[side], leaderHp: Math.min(maxHp, s[side].leaderHp + 4) };
        logs.push(`💚 ${playedCard.name}: 리더 4 회복`);
        break;
      }
      case 'mana_1': {
        s[side] = { ...s[side], mana: Math.min(MAX_MANA, s[side].mana + 1) };
        logs.push(`💎 ${playedCard.name}: 마나 +1`);
        break;
      }
      case 'face_dmg_3': {
        s[opp] = { ...s[opp], leaderHp: Math.max(0, s[opp].leaderHp - 3) };
        logs.push(`🎯 ${playedCard.name}: 적 리더 3 데미지`);
        break;
      }
      case 'silence': {
        if (aliveEnemies.length > 0) {
          const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
          s[opp] = { ...s[opp], field: s[opp].field.map(c => c.uid === target.uid ? { ...c, silenced: true, stealthUntil: 0 } : c) };
          logs.push(`🤫 ${playedCard.name}: ${target.name} 침묵`);
        }
        break;
      }
      default: break;
    }

    // 죽은 카드 정리
    s.player = { ...s.player, field: s.player.field.filter(c => c.currentHp > 0) };
    s.enemy = { ...s.enemy, field: s.enemy.field.filter(c => c.currentHp > 0) };
    return { state: s, logs };
  };

  // ===== 카드 내기 =====
  const playCardFromHand = useCallback((side, cardUid) => {
    const cur = stateRef.current;
    if (!cur || cur.gameOver) return;
    const p = cur[side];
    const card = p.hand.find(c => c.uid === cardUid);
    if (!card) return;
    if (p.mana < card.cost) {
      if (side === 'player') flushLogs(['💔 마나 부족']);
      return;
    }
    if (p.field.length >= FIELD_MAX) {
      if (side === 'player') flushLogs(['💔 필드 꽉 참']);
      return;
    }
    const now = Date.now();
    const sickness = side === 'enemy' ? SUMMONING_SICKNESS_MS_ENEMY : SUMMONING_SICKNESS_MS;
    const playedCard = {
      ...card,
      side,
      readyAt: now + sickness,
      stealthUntil: card.ability === 'stealth' ? now + STEALTH_DURATION_MS : 0
    };
    let s2 = {
      ...cur,
      [side]: {
        ...p,
        mana: p.mana - card.cost,
        hand: p.hand.filter(c => c.uid !== cardUid),
        field: [...p.field, playedCard]
      }
    };
    const bc = applyBattlecry(s2, side, playedCard);
    setState(bc.state);
    flushLogs([
      `${side === 'player' ? '🟢' : '🔴'} ${card.emoji} ${card.name} (${card.cost}💎)`,
      ...bc.logs
    ]);
  }, [flushLogs]);

  // ===== 공격 =====
  const performAttack = useCallback((side, attackerUid, target) => {
    const cur = stateRef.current;
    if (!cur || cur.gameOver) return;
    const opp = side === 'player' ? 'enemy' : 'player';
    const attacker = cur[side].field.find(c => c.uid === attackerUid);
    if (!attacker || attacker.currentHp <= 0) return;
    const now = Date.now();
    if (attacker.readyAt > now) {
      if (side === 'player') flushLogs([`⏳ ${attacker.name} 아직 준비 안 됨`]);
      return;
    }

    const logs = [];
    let s2 = { ...cur };
    const cooldownMs = side === 'enemy' ? ATTACK_COOLDOWN_MS_ENEMY : ATTACK_COOLDOWN_MS;
    const setAttackerCooldown = () => {
      s2[side] = {
        ...s2[side],
        field: s2[side].field.map(c => c.uid === attackerUid ? { ...c, readyAt: now + cooldownMs } : c)
      };
    };

    if (target === 'face') {
      const dmg = attacker.atk;
      s2[opp] = { ...s2[opp], leaderHp: Math.max(0, s2[opp].leaderHp - dmg) };
      logs.push(`⚔️ ${attacker.name} → 리더 ${dmg} 데미지`);
      setAttackerCooldown();
    } else {
      const defender = cur[opp].field.find(c => c.uid === target);
      if (!defender) return;
      if (defender.stealthUntil > now) {
        if (side === 'player') flushLogs([`👻 ${defender.name}은 은신 중!`]);
        return;
      }
      if (defender.phaserCharged && Math.random() < 0.5) {
        logs.push(`✨ ${defender.name} 페이저 회피!`);
        s2[opp] = {
          ...s2[opp],
          field: s2[opp].field.map(c => c.uid === defender.uid ? { ...c, phaserCharged: false } : c)
        };
        setAttackerCooldown();
        setState(s2);
        flushLogs(logs);
        return;
      }
      const advBonus = BEATS[attacker.type] === defender.type ? 2 : 0;
      const disadv = BEATS[defender.type] === attacker.type ? -1 : 0;
      const atkToDef = attacker.atk + advBonus + disadv;
      const defToAtk = defender.atk;
      logs.push(`⚔️ ${attacker.name} ↔ ${defender.name}${advBonus ? ' (상성+!)' : disadv ? ' (상성-)' : ''}`);
      s2[side] = {
        ...s2[side],
        field: s2[side].field.map(c => c.uid === attackerUid ? { ...c, readyAt: now + cooldownMs, currentHp: c.currentHp - defToAtk } : c)
      };
      s2[opp] = {
        ...s2[opp],
        field: s2[opp].field.map(c => c.uid === defender.uid ? { ...c, currentHp: c.currentHp - atkToDef } : c)
      };
      s2.player = { ...s2.player, field: s2.player.field.filter(c => c.currentHp > 0) };
      s2.enemy = { ...s2.enemy, field: s2.enemy.field.filter(c => c.currentHp > 0) };
    }
    setState(s2);
    flushLogs(logs);
  }, [flushLogs]);

  // ===== 실시간 틱: 마나 충전, 드로우, 강제 리렌더 =====
  useEffect(() => {
    if (!state || state.gameOver) return;
    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.gameOver) return;
      const now = Date.now();
      let s2 = { ...cur };
      let changed = false;

      // 플레이어 마나 충전 (1초/마나)
      const pManaElapsed = now - s2.lastManaTickAtPlayer;
      if (pManaElapsed >= MANA_TICK_MS_PLAYER) {
        const inc = Math.floor(pManaElapsed / MANA_TICK_MS_PLAYER);
        s2 = {
          ...s2,
          lastManaTickAtPlayer: s2.lastManaTickAtPlayer + inc * MANA_TICK_MS_PLAYER,
          player: { ...s2.player, mana: Math.min(MAX_MANA, s2.player.mana + inc) }
        };
        changed = true;
      }
      // 적 마나 충전 (2초/마나 — 절반 속도)
      const eManaElapsed = now - s2.lastManaTickAtEnemy;
      if (eManaElapsed >= MANA_TICK_MS_ENEMY) {
        const inc = Math.floor(eManaElapsed / MANA_TICK_MS_ENEMY);
        s2 = {
          ...s2,
          lastManaTickAtEnemy: s2.lastManaTickAtEnemy + inc * MANA_TICK_MS_ENEMY,
          enemy: { ...s2.enemy, mana: Math.min(MAX_MANA, s2.enemy.mana + inc) }
        };
        changed = true;
      }

      // 드로우 충전
      const drawElapsed = now - s2.lastDrawTickAt;
      if (drawElapsed >= DRAW_TICK_MS) {
        const inc = Math.floor(drawElapsed / DRAW_TICK_MS);
        let pDeck = [...s2.player.deck], pHand = [...s2.player.hand];
        let eDeck = [...s2.enemy.deck], eHand = [...s2.enemy.hand];
        for (let i = 0; i < inc; i++) {
          if (pDeck.length > 0 && pHand.length < HAND_MAX) { pHand.push(pDeck.shift()); }
          if (eDeck.length > 0 && eHand.length < HAND_MAX) { eHand.push(eDeck.shift()); }
        }
        s2 = {
          ...s2,
          lastDrawTickAt: s2.lastDrawTickAt + inc * DRAW_TICK_MS,
          player: { ...s2.player, deck: pDeck, hand: pHand },
          enemy: { ...s2.enemy, deck: eDeck, hand: eHand }
        };
        changed = true;
      }

      if (changed) setState(s2);
      setTick(t => t + 1); // 쿨다운 진행 표시용
    }, 200);
    return () => clearInterval(interval);
  }, [state?.gameOver, state?.startTime]); // eslint-disable-line

  // ===== AI 루프 =====
  useEffect(() => {
    if (!state || state.gameOver) return;
    const interval = setInterval(() => {
      const cur = stateRef.current;
      if (!cur || cur.gameOver) return;
      const e = cur.enemy;

      // 1. 카드 내기 — 필드에 2장 이상이면 잘 안 추가 (25% 확률), 1장 이하면 50%
      const playChance = e.field.length >= 2 ? 0.15 : 0.4;
      if (e.field.length < FIELD_MAX && Math.random() < playChance) {
        const playable = e.hand.filter(c => c.cost <= e.mana);
        if (playable.length > 0) {
          const pick = playable[Math.floor(Math.random() * playable.length)];
          playCardFromHand('enemy', pick.uid);
          return;
        }
      }

      // 2. 공격 — 50% 확률 (천천히 공격)
      const now = Date.now();
      const ready = e.field.filter(c => c.readyAt <= now && c.currentHp > 0);
      if (ready.length > 0 && Math.random() < 0.5) {
        const attacker = ready[Math.floor(Math.random() * ready.length)];
        const targets = cur.player.field.filter(c => c.stealthUntil <= now && c.currentHp > 0);
        let target;
        // 50% face, 50% 카드 (덜 face 직격)
        if (targets.length === 0 || Math.random() < 0.5) {
          target = 'face';
        } else {
          target = targets[Math.floor(Math.random() * targets.length)].uid;
        }
        performAttack('enemy', attacker.uid, target);
      }
    }, 1800);
    return () => clearInterval(interval);
  }, [state?.gameOver, state?.startTime, playCardFromHand, performAttack]); // eslint-disable-line

  // ===== 게임 종료 체크 =====
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
    if (!state || state.gameOver) return;
    playCardFromHand('player', cardUid);
  };
  const onClickFieldCard = (cardUid, side) => {
    if (!state || state.gameOver) return;
    if (side === 'player') {
      const now = Date.now();
      const card = state.player.field.find(c => c.uid === cardUid);
      if (!card || card.readyAt > now) {
        if (card) flushLogs([`⏳ ${card.name} ${Math.ceil((card.readyAt - now)/100)/10}초 대기`]);
        return;
      }
      if (pendingTarget?.attackerUid === cardUid) setPendingTarget(null);
      else setPendingTarget({ attackerUid: cardUid });
    } else {
      if (!pendingTarget) return;
      performAttack('player', pendingTarget.attackerUid, cardUid);
      setPendingTarget(null);
    }
  };
  const onClickEnemyFace = () => {
    if (!state || state.gameOver || !pendingTarget) return;
    performAttack('player', pendingTarget.attackerUid, 'face');
    setPendingTarget(null);
  };

  // ===== 렌더 =====
  if (stage === 'faction') {
    return (
      <div className="cb-screen">
        <div className="cb-header">
          <button className="back-btn" onClick={onBack}>←</button>
          <h2>⚔️ 잃도수 카드 배틀 (실시간)</h2>
        </div>
        <div className="cb-intro">
          <p className="cb-intro-line">진영을 골라 실시간 카드 배틀!</p>
          <div className="cb-howto">
            <p>🕒 <b>마나는 1초마다 1씩 자동 충전</b> (최대 10)</p>
            <p>🎴 손의 카드 클릭 → 필드에 등장 (마나만 충분하면 OK)</p>
            <p>⏳ 등장한 카드는 1.5초 후 공격 가능 (노랗게 빛남)</p>
            <p>⚔️ 내 필드 카드 클릭 → 적 카드 또는 적 리더 클릭</p>
            <p>❤️ 적 리더 HP 0으로 만들면 승리!</p>
            <p className="cb-faint">🔥불 → 🌿자연 → 💧물 → 🧠정신 → 🔥 (상성: +2 데미지)</p>
          </div>
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

  const now = Date.now();
  const playerHpPct = (state.player.leaderHp / state.player.leaderHpMax) * 100;
  const enemyHpPct = (state.enemy.leaderHp / state.enemy.leaderHpMax) * 100;

  return (
    <div className="cb-screen cb-battle-bg">
      <div className="cb-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>⚔️ 실시간 배틀</h2>
        <span className="cb-faction-tag" style={{ color: FACTION_INFO[faction].color }}>
          {FACTION_INFO[faction].emoji}
        </span>
      </div>

      {/* 적 리더 */}
      <div className={`cb-leader cb-leader-enemy ${pendingTarget ? 'cb-targetable-face' : ''}`} onClick={onClickEnemyFace}>
        <div className="cb-leader-info">
          <span className="cb-leader-emoji">{FACTION_INFO[faction === 'blackswan' ? 'neverseen' : 'blackswan'].emoji}</span>
          <span className="cb-leader-name">적 리더</span>
        </div>
        <div className="cb-leader-bars">
          <div className="cb-hp-bar">
            <div className="cb-hp-fill cb-hp-fill-enemy" style={{ width: `${enemyHpPct}%` }} />
            <span className="cb-hp-text">❤️ {state.enemy.leaderHp}/{state.enemy.leaderHpMax}</span>
          </div>
          <div className="cb-mana-bar">
            <div className="cb-mana-fill" style={{ width: `${(state.enemy.mana / MAX_MANA) * 100}%` }} />
            <span className="cb-mana-text">💎 {state.enemy.mana}/{MAX_MANA}</span>
          </div>
        </div>
        {pendingTarget && <span className="cb-target-badge">🎯 클릭!</span>}
      </div>

      {/* 적 손 (개수만) */}
      <div className="cb-row cb-hand-enemy">
        {state.enemy.hand.map((_, i) => <div key={i} className="cb-card-back-mini" />)}
        <span className="cb-hand-count">🃏 {state.enemy.deck.length}</span>
      </div>

      {/* 적 필드 */}
      <div className="cb-field cb-field-enemy">
        {state.enemy.field.length === 0 && <div className="cb-field-empty">적 필드 비어있음</div>}
        {state.enemy.field.map(c => (
          <CardView
            key={c.uid}
            card={c}
            now={now}
            onClick={() => onClickFieldCard(c.uid, 'enemy')}
            targetable={!!pendingTarget && c.stealthUntil <= now}
          />
        ))}
      </div>

      <div className="cb-mid">
        <div className="cb-log">
          {log.slice(-3).map(l => <div key={l.id} className="cb-log-line">{l.text}</div>)}
        </div>
      </div>

      {/* 내 필드 */}
      <div className="cb-field cb-field-player">
        {state.player.field.length === 0 && <div className="cb-field-empty">내 필드 비어있음 — 손의 카드 클릭해서 등장!</div>}
        {state.player.field.map(c => (
          <CardView
            key={c.uid}
            card={c}
            now={now}
            highlight={pendingTarget?.attackerUid === c.uid}
            onClick={() => onClickFieldCard(c.uid, 'player')}
            ready={c.readyAt <= now}
            isMine
          />
        ))}
      </div>

      {/* 내 리더 */}
      <div className="cb-leader cb-leader-player">
        <div className="cb-leader-info">
          <span className="cb-leader-emoji">{FACTION_INFO[faction].emoji}</span>
          <span className="cb-leader-name">{user.nickname}</span>
        </div>
        <div className="cb-leader-bars">
          <div className="cb-hp-bar">
            <div className="cb-hp-fill cb-hp-fill-player" style={{ width: `${playerHpPct}%` }} />
            <span className="cb-hp-text">❤️ {state.player.leaderHp}/{state.player.leaderHpMax}</span>
          </div>
          <div className="cb-mana-bar">
            <div className="cb-mana-fill" style={{ width: `${(state.player.mana / MAX_MANA) * 100}%` }} />
            <span className="cb-mana-text">💎 {state.player.mana}/{MAX_MANA}</span>
          </div>
        </div>
        <span className="cb-leader-deck">🃏 {state.player.deck.length}</span>
      </div>

      {/* 내 손 */}
      <div className="cb-hand-player">
        {state.player.hand.map(c => (
          <CardView
            key={c.uid}
            card={c}
            now={now}
            isInHand
            playable={state.player.mana >= c.cost && state.player.field.length < FIELD_MAX}
            onClick={() => onClickHandCard(c.uid)}
          />
        ))}
      </div>
    </div>
  );
}

// ===== 카드 뷰 =====
function CardView({ card, now, highlight, onClick, isInHand, playable, ready, targetable, isMine }) {
  const t = TYPES[card.type];
  const hpPct = (card.currentHp / card.hp) * 100;
  const inCooldown = !isInHand && card.readyAt > now;
  const cooldownPct = inCooldown
    ? Math.min(100, 100 * (1 - (card.readyAt - now) / (ATTACK_COOLDOWN_MS)))
    : 100;
  const stealthActive = card.stealthUntil > now;
  const cls = [
    'cb-card',
    isInHand ? 'cb-card-hand' : 'cb-card-field',
    highlight ? 'cb-highlight' : '',
    isInHand && playable ? 'cb-playable' : '',
    isInHand && !playable ? 'cb-unplayable' : '',
    !isInHand && ready ? 'cb-ready' : '',
    !isInHand && inCooldown ? 'cb-cooldown' : '',
    targetable ? 'cb-targetable' : '',
    stealthActive ? 'cb-stealth' : '',
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
        {inCooldown && (
          <div className="cb-cooldown-overlay">
            <div className="cb-cooldown-bar" style={{ width: `${cooldownPct}%` }} />
          </div>
        )}
      </div>
      {stealthActive && <div className="cb-badge cb-badge-stealth">👻 은신</div>}
      {card.silenced && <div className="cb-badge cb-badge-silenced">🤫 침묵</div>}
    </div>
  );
}
