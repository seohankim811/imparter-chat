// 현재 URL 경로로 모드 감지
// `/kotlc` 또는 `/kotlc/...` → 잃도수 버전
// 그 외 → 일반 캔바 버전

export function getMode() {
  const path = window.location.pathname;
  if (path.startsWith('/kotlc')) return 'kotlc';
  return 'canva';
}

export const MODES = {
  kotlc: {
    name: 'kotlc',
    appTitle: 'Imparter',
    appSubtitle: '잃어버린 도시의 메신저',
    appLogo: '✨',
    roomListTitle: '빛의 방',
    createRoomText: '+ 새로운 빛의 방 만들기',
    joinButtonText: '빛의 다리 건너기',
    enterMessage: '님이 빛의 다리를 건너 입장했습니다',
    leaveMessage: '님이 빛의 다리를 건너 퇴장했습니다',
    nicknameLabel: '엘프 이름',
    avatarLabel: '캐릭터 선택',
    defaultTheme: 'cosmos',
    icons: [
      { id: 'sophie', emoji: '✨', name: 'Sophie' },
      { id: 'fitz', emoji: '👑', name: 'Fitz' },
      { id: 'keefe', emoji: '🎨', name: 'Keefe' },
      { id: 'biana', emoji: '💎', name: 'Biana' },
      { id: 'dex', emoji: '⚙️', name: 'Dex' },
      { id: 'tam', emoji: '🌑', name: 'Tam' },
      { id: 'linh', emoji: '🌊', name: 'Linh' },
      { id: 'marella', emoji: '🔥', name: 'Marella' },
    ]
  },
  canva: {
    name: 'canva',
    appTitle: 'ChatBubble',
    appSubtitle: '친구들과 편하게 수다',
    appLogo: '💬',
    roomListTitle: '채팅방',
    createRoomText: '+ 새 채팅방 만들기',
    joinButtonText: '시작하기',
    enterMessage: '님이 입장했습니다',
    leaveMessage: '님이 나갔습니다',
    nicknameLabel: '닉네임',
    avatarLabel: '아바타 선택',
    defaultTheme: 'neon',
    icons: [
      { id: 'cat', emoji: '🐱', name: '고양이' },
      { id: 'dog', emoji: '🐶', name: '강아지' },
      { id: 'fox', emoji: '🦊', name: '여우' },
      { id: 'panda', emoji: '🐼', name: '판다' },
      { id: 'bunny', emoji: '🐰', name: '토끼' },
      { id: 'bear', emoji: '🐻', name: '곰' },
      { id: 'koala', emoji: '🐨', name: '코알라' },
      { id: 'tiger', emoji: '🐯', name: '호랑이' },
      { id: 'monkey', emoji: '🐵', name: '원숭이' },
      { id: 'pig', emoji: '🐷', name: '돼지' },
      { id: 'frog', emoji: '🐸', name: '개구리' },
      { id: 'chick', emoji: '🐥', name: '병아리' },
    ]
  }
};

export function getCurrentModeConfig() {
  return MODES[getMode()];
}
