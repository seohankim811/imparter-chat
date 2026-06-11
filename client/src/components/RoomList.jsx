import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { getCurrentModeConfig, getMode } from '../mode';
import { isUnlocked, getLockMessage } from '../unlocks';

// 관리자 닉네임 (서버 ADMIN_NICKNAMES와 동기 유지)
const ADMIN_NICKNAMES = new Set(['서한']);
const isAdminNick = (nick) => !!nick && ADMIN_NICKNAMES.has(nick);

export default function RoomList({ user, onJoinRoom, onLogout, onOpenGame, onOpenProfile, theme, toggleTheme }) {
  const modeConfig = getCurrentModeConfig();
  const isKotlc = getMode() === 'kotlc';
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const onJoinRoomRef = useRef(onJoinRoom);

  useEffect(() => { onJoinRoomRef.current = onJoinRoom; }, [onJoinRoom]);

  useEffect(() => {
    const mode = getMode();
    // 현재 모드를 서버에 먼저 알림 (관리자 키 함께)
    let adminSecret;
    try { adminSecret = sessionStorage.getItem('imparter-admin-key') || undefined; } catch (_) {}
    socket.emit('set-user', { nickname: user.nickname, icon: user.icon, mode, adminSecret });
    socket.emit('get-rooms', { mode });
    socket.emit('get-profile', { nickname: user.nickname });

    socket.on('room-list', (roomList) => {
      setRooms(roomList);
    });

    socket.on('room-list-updated', () => {
      socket.emit('get-rooms', { mode });
    });

    socket.on('room-created', (roomName) => {
      onJoinRoomRef.current(roomName);
    });

    socket.on('profile-data', (p) => {
      if (p && p.nickname === user.nickname) setMyProfile(p);
    });

    return () => {
      socket.off('room-list');
      socket.off('room-list-updated');
      socket.off('room-created');
      socket.off('profile-data');
    };
  }, [user.nickname]);

  const handleClaudeClick = () => {
    if (!isUnlocked('ai_claude', myProfile)) {
      alert(getLockMessage('ai_claude'));
      return;
    }
    onJoinRoom(`__claude__${user.nickname}`);
  };

  // KOTLC 캐릭터 1:1 페르소나 채팅
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const PERSONA_LIST = [
    { id: 'sophie', emoji: '✨', name: 'Sophie', desc: '주인공 엘프' },
    { id: 'keefe', emoji: '🎨', name: 'Keefe', desc: '장난꾸러기 Empath' },
    { id: 'fitz', emoji: '👑', name: 'Fitz', desc: '완벽한 Vacker' },
    { id: 'biana', emoji: '💎', name: 'Biana', desc: 'Vanisher' },
    { id: 'dex', emoji: '⚙️', name: 'Dex', desc: 'Technopath 친구' },
    { id: 'tam', emoji: '🌑', name: 'Tam', desc: 'Shade · 쿨내' },
    { id: 'linh', emoji: '🌊', name: 'Linh', desc: '부드러운 Hydrokinetic' },
    { id: 'keefe_dad', emoji: '💙', name: 'Keefe (진지)', desc: '다정한 Keefe' },
  ];
  const handlePersonaClick = (charId) => {
    if (!isUnlocked('ai_claude', myProfile)) {
      alert(getLockMessage('ai_claude'));
      return;
    }
    setShowPersonaPicker(false);
    onJoinRoom(`__persona__${charId}__${user.nickname}`);
  };

  const [newRoomPassword, setNewRoomPassword] = useState('');

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    const name = newRoomName.trim();
    const mode = getMode();
    socket.emit('create-room', name, { mode });
    if (newRoomPassword.trim()) {
      // 방 생성되는대로 비밀번호 설정
      setTimeout(() => {
        socket.emit('set-room-password', { roomName: name, password: newRoomPassword.trim(), mode });
      }, 300);
    }
    setNewRoomName('');
    setNewRoomPassword('');
    setShowCreate(false);
  };

  const handleJoinProtectedRoom = (roomName) => {
    const mode = getMode();
    socket.emit('check-room-password', { roomName, password: '', mode });
    const checkHandler = ({ required, ok, label, scheduled }) => {
      socket.off('room-password-check', checkHandler);
      if (!required) {
        onJoinRoomRef.current(roomName);
      } else {
        const scheduleHint = scheduled
          ? `\n🕐 지금은 시간대별 비번 적용 중${label ? ` (${label})` : ''}`
          : '';
        const pw = prompt(`🔒 "${roomName}" 비밀방 입장${scheduleHint}\n비밀번호를 입력하세요:`);
        if (pw === null) return;
        socket.emit('check-room-password', { roomName, password: pw, mode });
        const verifyHandler = ({ ok }) => {
          socket.off('room-password-check', verifyHandler);
          if (ok) {
            onJoinRoomRef.current(roomName);
          } else {
            alert('❌ 비밀번호가 틀렸어요!');
          }
        };
        socket.on('room-password-check', verifyHandler);
      }
    };
    socket.on('room-password-check', checkHandler);
  };

  return (
    <div className="room-list-container">
      <div className="stars-bg" />

      <div className="room-list-header">
        <h2>{modeConfig.roomListTitle}</h2>
        <button className="icon-header-btn" onClick={toggleTheme} title="테마 변경">
          🎨
        </button>
        <button className="header-user-btn" onClick={onOpenProfile} title="내 프로필">
          <span className="header-icon">{user?.icon?.emoji || '✨'}</span>
          <span className="header-nickname header-nickname-compact">{user?.nickname || ''}</span>
        </button>
        <button className="logout-btn" onClick={onLogout}>나가기</button>
      </div>

      <div className="room-list-content">
        {/* 클로드 AI 채팅방 */}
        <button
          className={`claude-banner ${!isUnlocked('ai_claude', myProfile) ? 'locked-btn' : ''}`}
          onClick={handleClaudeClick}
        >
          <div className="claude-banner-icon">{isUnlocked('ai_claude', myProfile) ? '🤖' : '🔒'}</div>
          <div className="claude-banner-info">
            <span className="claude-banner-title">
              {isUnlocked('ai_claude', myProfile) ? '✨ 클로드와 1:1 채팅' : '🔒 클로드 AI (잠김)'}
            </span>
            <span className="claude-banner-desc">
              {isUnlocked('ai_claude', myProfile)
                ? '진짜 AI랑 대화하기 - 뭐든지 물어봐!'
                : '💬 수다쟁이 배지 필요 (메시지 100개)'}
            </span>
          </div>
          <div className="claude-banner-status">
            <span className="claude-pulse"></span>
            {isUnlocked('ai_claude', myProfile) ? 'ONLINE' : 'LOCKED'}
          </div>
        </button>

        {/* KOTLC 캐릭터 1:1 채팅 (잃도수 모드만) */}
        {isKotlc && (
          <button
            className={`persona-banner ${!isUnlocked('ai_claude', myProfile) ? 'locked-btn' : ''}`}
            onClick={() => {
              if (!isUnlocked('ai_claude', myProfile)) { alert(getLockMessage('ai_claude')); return; }
              setShowPersonaPicker(v => !v);
            }}
          >
            <div className="persona-banner-icon">{isUnlocked('ai_claude', myProfile) ? '🧝' : '🔒'}</div>
            <div className="persona-banner-info">
              <span className="persona-banner-title">
                {isUnlocked('ai_claude', myProfile) ? '✨ KOTLC 캐릭터와 1:1 채팅' : '🔒 캐릭터 채팅 (잠김)'}
              </span>
              <span className="persona-banner-desc">
                {isUnlocked('ai_claude', myProfile)
                  ? 'Sophie, Keefe, Fitz 등 — 진짜처럼 대화'
                  : '💬 수다쟁이 배지 필요 (메시지 100개)'}
              </span>
            </div>
            <div className="persona-banner-status">{showPersonaPicker ? '▲' : '▼'}</div>
          </button>
        )}
        {isKotlc && showPersonaPicker && isUnlocked('ai_claude', myProfile) && (
          <div className="persona-picker-grid">
            {PERSONA_LIST.map(p => (
              <button key={p.id} className="persona-card" onClick={() => handlePersonaClick(p.id)}>
                <span className="persona-card-emoji">{p.emoji}</span>
                <span className="persona-card-name">{p.name}</span>
                <span className="persona-card-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* 게임 배너 (잃도수 모드만) — 3개 가로 나란히 */}
        {isKotlc && (
          <div className="game-banners-row game-banners-row-3">
            <button className="game-banner game-banner-third" onClick={() => onOpenGame('rts')}>
              <div className="game-banner-icon">⚔️</div>
              <div className="game-banner-info">
                <span className="game-banner-title">잃도수 RTS</span>
                <span className="game-banner-desc">실시간 전략</span>
              </div>
              <div className="game-banner-play">▶</div>
            </button>
            <button className="game-banner game-banner-third game-banner-keeper" onClick={() => onOpenGame('keeper')}>
              <div className="game-banner-icon">🏰</div>
              <div className="game-banner-info">
                <span className="game-banner-title">갓물주 잃도수</span>
                <span className="game-banner-desc">키우기</span>
              </div>
              <div className="game-banner-play">▶</div>
            </button>
            <button className="game-banner game-banner-third game-banner-cardbattle" onClick={() => onOpenGame('cardbattle')}>
              <div className="game-banner-icon">🌹</div>
              <div className="game-banner-info">
                <span className="game-banner-title">블랙스완 vs 마티치</span>
                <span className="game-banner-desc">카드 배틀</span>
              </div>
              <div className="game-banner-play">▶</div>
            </button>
          </div>
        )}

        {/* 방 검색창 */}
        <div className="room-search-wrap">
          <span className="room-search-icon">🔍</span>
          <input
            type="text"
            className="room-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isKotlc ? '빛의 방 검색…' : '채팅방 검색…'}
            maxLength={30}
          />
          {searchQuery && (
            <button className="room-search-clear" onClick={() => setSearchQuery('')} aria-label="지우기">✕</button>
          )}
        </div>

        {rooms.length === 0 && !showCreate && (
          <div className="empty-rooms">
            <span className="empty-icon">🌟</span>
            <p>아직 열린 방이 없습니다</p>
            <p className="empty-sub">{isKotlc ? '새로운 빛의 방을 만들어보세요' : '새 채팅방을 만들어보세요'}</p>
          </div>
        )}

        {(() => {
          const q = searchQuery.trim().toLowerCase();
          const visible = rooms
            .filter(r => !r.name.startsWith('__claude__'))
            .filter(r => !q || r.name.toLowerCase().includes(q));
          if (rooms.length > 0 && visible.length === 0) {
            return (
              <div className="empty-rooms">
                <span className="empty-icon">🤷</span>
                <p>"{searchQuery}" 검색 결과 없음</p>
                <p className="empty-sub">방 이름을 다시 확인해보세요</p>
              </div>
            );
          }
          return visible.map((room) => {
          const lastSeenKey = `imparter-lastseen-${getMode()}-${room.name}`;
          const lastSeen = parseInt(localStorage.getItem(lastSeenKey) || '0');
          const hasUnread = room.lastMessageTime && room.lastMessageTime > lastSeen;
          return (
          <button
            key={room.name}
            className={`room-item ${hasUnread ? 'has-unread' : ''}`}
            onClick={() => handleJoinProtectedRoom(room.name)}
          >
            <div className="room-icon">{room.hasPassword ? '🔒' : '✨'}</div>
            <div className="room-info">
              <span className="room-name">
                {room.name}
                {hasUnread && <span className="unread-dot">●</span>}
                {isAdminNick(user?.nickname) && room.hasPassword && room.password && (
                  <span className="admin-password-tag" title="관리자 전용 표시">
                    🔓 {room.password}
                  </span>
                )}
              </span>
              <span className="room-last-msg">{room.lastMessage || '아직 메시지가 없습니다'}</span>
            </div>
            <div className="room-meta">
              <span className="room-users">{room.userCount}명</span>
            </div>
          </button>
          );
          });
        })()}
      </div>

      {showCreate ? (
        <form className="create-room-form" onSubmit={handleCreateRoom}>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="방 이름"
            autoFocus
            maxLength={30}
          />
          <input
            type="password"
            value={newRoomPassword}
            onChange={(e) => setNewRoomPassword(e.target.value)}
            placeholder="🔒 비밀번호 (선택)"
            maxLength={20}
          />
          <button type="submit" className="create-submit-btn">만들기</button>
          <button type="button" className="create-cancel-btn" onClick={() => setShowCreate(false)}>취소</button>
        </form>
      ) : (
        <button className="create-room-btn" onClick={() => setShowCreate(true)}>
          {modeConfig.createRoomText}
        </button>
      )}
    </div>
  );
}
