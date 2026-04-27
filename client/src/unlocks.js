// 배지 기반 잠금 해제 시스템
// 어떤 기능이 어떤 배지/조건으로 잠금 해제되는지 정의

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
