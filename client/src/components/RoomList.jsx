import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { getCurrentModeConfig, getMode } from '../mode';

export default function RoomList({ user, onJoinRoom, onLogout, onOpenGame, onOpenProfile, theme, toggleTheme }) {
  const modeConfig = getCurrentModeConfig();
  const isKotlc = getMode() === 'kotlc';
  const [rooms, setRooms] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const onJoinRoomRef = useRef(onJoinRoom);

  useEffect(() => { onJoinRoomRef.current = onJoinRoom; }, [onJoinRoom]);

  useEffect(() => {
    const mode = getMode();
    // 현재 모드를 서버에 먼저 알림
    socket.emit('set-user', { nickname: user.nickname, icon: user.icon, mode });
    socket.emit('get-rooms', { mode });

    socket.on('room-list', (roomList) => {
      setRooms(roomList);
    });

    socket.on('room-list-updated', () => {
      socket.emit('get-rooms', { mode });
    });

    socket.on('room-created', (roomName) => {
      onJoinRoomRef.current(roomName);
    });

    return () => {
      socket.off('room-list');
      socket.off('room-list-updated');
      socket.off('room-created');
    };
  }, [user.nickname]);

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
    const checkHandler = ({ required, ok }) => {
      socket.off('room-password-check', checkHandler);
      if (!required) {
        onJoinRoomRef.current(roomName);
      } else {
        const pw = prompt(`🔒 "${roomName}" 비밀방 입장\n비밀번호를 입력하세요:`);
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
        <button className="header-user-btn" onClick={onOpenProfile} title="내 프로필">
          <span className="header-icon">{user?.icon?.emoji || '✨'}</span>
          <span className="header-nickname">{user?.nickname || ''}</span>
        </button>
        <h2>{modeConfig.roomListTitle}</h2>
        <button className="icon-header-btn" onClick={toggleTheme} title="테마 변경">
          🎨
        </button>
        <button className="logout-btn" onClick={onLogout}>나가기</button>
      </div>

      <div className="room-list-content">
        {/* 클로드 AI 채팅방 */}
        <button className="claude-banner" onClick={() => onJoinRoom(`__claude__${user.nickname}`)}>
          <div className="claude-banner-icon">🤖</div>
          <div className="claude-banner-info">
            <span className="claude-banner-title">✨ 클로드와 1:1 채팅</span>
            <span className="claude-banner-desc">진짜 AI랑 대화하기 - 뭐든지 물어봐!</span>
          </div>
          <div className="claude-banner-status">
            <span className="claude-pulse"></span>
            ONLINE
          </div>
        </button>

        {/* 게임 배너 (잃도수 모드만) */}
        {isKotlc && (
          <div className="game-banners-row">
            <button className="game-banner game-banner-half" onClick={() => onOpenGame('rts')}>
              <div className="game-banner-icon">⚔️</div>
              <div className="game-banner-info">
                <span className="game-banner-title">잃도수 RTS</span>
                <span className="game-banner-desc">실시간 전략</span>
              </div>
              <div className="game-banner-play">▶</div>
            </button>
            <button className="game-banner game-banner-half game-banner-keeper" onClick={() => onOpenGame('keeper')}>
              <div className="game-banner-icon">🏰</div>
              <div className="game-banner-info">
                <span className="game-banner-title">갓물주 잃도수</span>
                <span className="game-banner-desc">키우기 게임</span>
              </div>
              <div className="game-banner-play">▶</div>
            </button>
          </div>
        )}

        {rooms.length === 0 && !showCreate && (
          <div className="empty-rooms">
            <span className="empty-icon">🌟</span>
            <p>아직 열린 방이 없습니다</p>
            <p className="empty-sub">{isKotlc ? '새로운 빛의 방을 만들어보세요' : '새 채팅방을 만들어보세요'}</p>
          </div>
        )}

        {rooms.filter(r => !r.name.startsWith('__claude__')).map((room) => (
          <button
            key={room.name}
            className="room-item"
            onClick={() => handleJoinProtectedRoom(room.name)}
          >
            <div className="room-icon">{room.hasPassword ? '🔒' : '✨'}</div>
            <div className="room-info">
              <span className="room-name">{room.name}</span>
              <span className="room-last-msg">{room.lastMessage || '아직 메시지가 없습니다'}</span>
            </div>
            <div className="room-meta">
              <span className="room-users">{room.userCount}명</span>
            </div>
          </button>
        ))}
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
