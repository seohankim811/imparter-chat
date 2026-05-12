// 배지 기반 잠금 해제 시스템
// 어떤 기능이 어떤 배지/조건으로 잠금 해제되는지 정의

// 배지별 조건 임계값 (server/index.js의 checkBadges와 일치해야 함)
export const BADGE_THRESHOLDS = {
  first_message: { stat: 'messageCount', threshold: 1, label: '메시지 1개' },
  chatty: { stat: 'messageCount', threshold: 100, label: '메시지 100개' },
  veteran: { stat: 'messageCount', threshold: 500, label: '메시지 500개' },
  legend: { stat: 'messageCount', threshold: 1000, label: '메시지 1000개' },
  photographer: { stat: 'imageCount', threshold: 10, label: '사진 10장' },
  gamer: { stat: 'gamesPlayed', threshold: 10, label: '게임 10번' },
  winner: { stat: 'gamesWon', threshold: 5, label: '게임 5승' }
};

export const UNLOCKS = {
  sticker: {
    name: '🎨 스티커',
    requires: { type: 'badge', badge: 'first_message' },
    requiresLabel: '🌱 첫 발자국 배지 필요 (첫 메시지 보내기)'
  },
  ai_claude: {
    name: '🤖 클로드 AI 채팅',
    requires: { type: 'badge', badge: 'chatty' },
    requiresLabel: '💬 수다쟁이 배지 필요 (메시지 100개)'
  },
  party_effect: {
    name: '🎊 파티 효과',
    requires: { type: 'badge', badge: 'first_message' },
    requiresLabel: '🌱 첫 발자국 배지 필요'
  },
  voice_message: {
    name: '🎤 음성 메시지',
    requires: { type: 'badge', badge: 'veteran' },
    requiresLabel: '⭐ 베테랑 배지 필요 (메시지 500개)'
  },
  special_themes: {
    name: '👑 특별 테마 (네온, 포레스트, 오션)',
    requires: { type: 'level', level: 5 },
    requiresLabel: 'Lv.5 이상'
  },
  video_message: {
    name: '🎥 비디오 메시지',
    requires: { type: 'level', level: 3 },
    requiresLabel: 'Lv.3 이상'
  }
};

// 프로필을 받아서 잠금 상태 체크
export function isUnlocked(featureKey, profile) {
  if (!profile) return false;
  const unlock = UNLOCKS[featureKey];
  if (!unlock) return true;

  const req = unlock.requires;
  if (req.type === 'badge') {
    return Array.isArray(profile.badges) && profile.badges.includes(req.badge);
  }
  if (req.type === 'level') {
    return (profile.level || 1) >= req.level;
  }
  return true;
}

// 도움말 메시지
export function getLockMessage(featureKey) {
  const unlock = UNLOCKS[featureKey];
  if (!unlock) return '';
  return `🔒 잠긴 기능: ${unlock.name}\n\n${unlock.requiresLabel}\n\n계속 채팅하면 자동으로 잠금 해제돼요!`;
}

// 새 배지 획득 시 잠금 해제된 기능 목록
export function unlocksFromBadge(badgeKey) {
  return Object.entries(UNLOCKS)
    .filter(([, u]) => u.requires.type === 'badge' && u.requires.badge === badgeKey)
    .map(([key, u]) => ({ key, name: u.name }));
}

// 레벨업 시 잠금 해제된 기능 목록
export function unlocksFromLevel(newLevel) {
  return Object.entries(UNLOCKS)
    .filter(([, u]) => u.requires.type === 'level' && u.requires.level === newLevel)
    .map(([key, u]) => ({ key, name: u.name }));
}

// 잠금 진행도 계산: { percent, current, target, label } 반환
export function getUnlockProgress(featureKey, profile) {
  const unlock = UNLOCKS[featureKey];
  if (!unlock || !profile) return { percent: 0, current: 0, target: 1, label: '' };
  const req = unlock.requires;
  if (req.type === 'badge') {
    const t = BADGE_THRESHOLDS[req.badge];
    if (!t) return { percent: 0, current: 0, target: 1, label: '' };
    const current = profile[t.stat] || 0;
    const percent = Math.min(100, (current / t.threshold) * 100);
    return { percent, current, target: t.threshold, label: t.label };
  }
  if (req.type === 'level') {
    const current = profile.level || 1;
    const percent = Math.min(100, (current / req.level) * 100);
    return { percent, current, target: req.level, label: `Lv.${req.level}` };
  }
  return { percent: 100, current: 1, target: 1, label: '' };
}
