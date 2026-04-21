import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { getMode } from '../mode';
import VoiceRecorder from './VoiceRecorder';
import PartyEffect, { hasPartyTrigger } from './PartyEffect';
import Message from './Message';

// 큰 스티커 (카톡 이모티콘처럼)
const STICKERS = [
  { id: 'wow', emoji: '🤩', name: '와우' },
  { id: 'love', emoji: '😍', name: '사랑해' },
  { id: 'cry', emoji: '😭', name: '엉엉' },
  { id: 'laugh', emoji: '🤣', name: 'ㅋㅋㅋ' },
  { id: 'shock', emoji: '😱', name: '헐' },
  { id: 'sleepy', emoji: '🥱', name: '졸려' },
  { id: 'hungry', emoji: '🤤', name: '배고파' },
  { id: 'cool', emoji: '😎', name: '멋짐' },
  { id: 'party', emoji: '🥳', name: '파티' },
  { id: 'think', emoji: '🤯', name: '대박' },
  { id: 'ok', emoji: '👌', name: 'OK' },
  { id: 'thumbs', emoji: '👍', name: '최고' },
  { id: 'clap', emoji: '👏', name: '짝짝' },
  { id: 'heart', emoji: '💖', name: '하트' },
  { id: 'fire', emoji: '🔥', name: '불타' },
  { id: 'star', emoji: '⭐', name: '별' },
  { id: 'unicorn', emoji: '🦄', name: '유니콘' },
  { id: 'rainbow', emoji: '🌈', name: '무지개' },
];

const EMOTICON_CATEGORIES = [
  {
    name: '캐릭터',
    emojis: [
      { emoji: '✨', label: 'Sophie' },
      { emoji: '👑', label: 'Fitz' },
      { emoji: '🎨', label: 'Keefe' },
      { emoji: '💎', label: 'Biana' },
      { emoji: '⚙️', label: 'Dex' },
      { emoji: '🌑', label: 'Tam' },
      { emoji: '🌊', label: 'Linh' },
      { emoji: '🔥', label: 'Marella' },
    ]
  },
  {
    name: '능력',
    emojis: [
      { emoji: '🧠', label: '텔레파시' },
      { emoji: '💫', label: '순간이동' },
      { emoji: '🌟', label: '빛의 힘' },
      { emoji: '🔮', label: '예언' },
      { emoji: '🛡️', label: '보호막' },
      { emoji: '⚡', label: '번개' },
      { emoji: '🌪️', label: '바람' },
      { emoji: '❄️', label: '얼음' },
    ]
  },
  {
    name: '장소',
    emojis: [
      { emoji: '🏰', label: 'Eternalia' },
      { emoji: '🌳', label: 'Calla 나무' },
      { emoji: '🌉', label: '빛의 다리' },
      { emoji: '🏔️', label: '금지된 도시' },
      { emoji: '🌺', label: 'Havenfield' },
      { emoji: '🦄', label: 'Alicorn' },
      { emoji: '🧝', label: '엘프' },
      { emoji: '🌈', label: '무지개' },
    ]
  },
  {
    name: '감정',
    emojis: [
      { emoji: '😊', label: '기쁨' },
      { emoji: '😢', label: '슬픔' },
      { emoji: '😤', label: '화남' },
      { emoji: '🤔', label: '생각' },
      { emoji: '😱', label: '놀람' },
      { emoji: '🥺', label: '부탁' },
      { emoji: '😂', label: '웃김' },
      { emoji: '❤️', label: '사랑' },
      { emoji: '💪', label: '힘내' },
      { emoji: '👍', label: '좋아요' },
      { emoji: '👋', label: '안녕' },
      { emoji: '🎉', label: '축하' },
      { emoji: '😴', label: '졸림' },
      { emoji: '🤗', label: '포옹' },
      { emoji: '😎', label: '멋짐' },
      { emoji: '🙏', label: '감사' },
    ]
  }
];

// AudioContext 싱글톤 (iOS 크래시 방지)
let sharedAudioContext = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) sharedAudioContext = new Ctor();
    } catch (e) {}
  }
  return sharedAudioContext;
}

function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

// 이미지 리사이즈 (용량 줄이기)
function resizeImage(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatRoom({ user, roomName, onLeave, theme, toggleTheme }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomUsers, setRoomUsers] = useState([]);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const messagesEndRef = useRef(null);
  const [ownerId, setOwnerId] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [soundOn, setSoundOn] = useState(() => {
    return localStorage.getItem('imparter-sound') !== 'off';
  });
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [partyTrigger, setPartyTrigger] = useState(0);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const isFirstLoad = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    window.__currentRoom = roomName;
    window.__currentMode = getMode();
    // 방 들어올 때 lastSeen 업데이트
    const lastSeenKey = `imparter-lastseen-${getMode()}-${roomName}`;
    localStorage.setItem(lastSeenKey, Date.now().toString());
    return () => {
      window.__currentRoom = null;
      window.__currentMode = null;
      // 나갈 때도 업데이트
      localStorage.setItem(lastSeenKey, Date.now().toString());
    };
  }, [roomName]);

  useEffect(() => {
    let firstLoadTimeout = null;
    const joinRoom = () => {
      socket.emit('set-user', { nickname: user.nickname, icon: user.icon, mode: getMode() });
      socket.emit('join-room', roomName, { mode: getMode() });
    };

    joinRoom();

    socket.on('connect', () => {
      setConnected(true);
      joinRoom();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room-history', (history) => {
      setMessages(history.map(m => ({ ...m, type: 'message' })));
      clearTimeout(firstLoadTimeout);
      isFirstLoad.current = true;
      firstLoadTimeout = setTimeout(() => { isFirstLoad.current = false; }, 500);
    });

    socket.on('new-message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, { ...msg, type: 'message' }];
      });
      if (!isFirstLoad.current && msg.nickname !== user.nickname && soundOnRef.current && document.visibilityState === 'visible') {
        playNotificationSound();
      }
      // 🎉 파티 효과 트리거!
      if (!isFirstLoad.current && hasPartyTrigger(msg.text)) {
        setPartyTrigger(t => t + 1);
      }
    });

    socket.on('message-updated', (updatedMsg) => {
      setMessages(prev => prev.map(m =>
        m.id === updatedMsg.id ? { ...updatedMsg, type: 'message' } : m
      ));
    });

    socket.on('system-message', (msg) => {
      setMessages(prev => [...prev, { ...msg, type: 'system' }]);
    });

    socket.on('room-users', (users) => {
      setRoomUsers(users);
    });

    socket.on('room-owner', (ownerNickname) => {
      setOwnerId(ownerNickname);
      setIsOwner(ownerNickname === user.nickname);
    });

    socket.on('kicked', ({ roomName: kickedRoom }) => {
      if (kickedRoom === roomName) {
        alert('방장에 의해 추방당했습니다!');
        onLeave();
      }
    });

    socket.on('room-deleted', ({ roomName: deletedRoom }) => {
      if (deletedRoom === roomName) {
        alert('🗑️ 방이 삭제되었습니다.');
        onLeave();
      }
    });

    socket.on('room-delete-error', ({ message }) => {
      alert(`❌ ${message}`);
    });

    socket.on('user-typing', ({ nickname, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          if (prev.includes(nickname)) return prev;
          return [...prev, nickname];
        } else {
          return prev.filter(n => n !== nickname);
        }
      });
    });

    socket.on('message-reaction', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, reactions } : m
      ));
    });

    return () => {
      clearTimeout(firstLoadTimeout);
      clearTimeout(typingTimeoutRef.current);
      socket.emit('leave-room', roomName, { mode: getMode() });
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-history');
      socket.off('new-message');
      socket.off('message-updated');
      socket.off('system-message');
      socket.off('room-users');
      socket.off('room-owner');
      socket.off('kicked');
      socket.off('room-deleted');
      socket.off('room-delete-error');
      socket.off('user-typing');
      socket.off('message-reaction');
    };
  }, [roomName, onLeave, user.nickname]);

  useEffect(() => {
    if (!showSearch) scrollToBottom();
  }, [messages, typingUsers, showSearch]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    socket.emit('typing', { roomName, isTyping: true, mode: getMode() });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomName, isTyping: false, mode: getMode() });
    }, 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();

    if (editingMessage) {
      if (input.trim()) {
        socket.emit('edit-message', { roomName, messageId: editingMessage.id, newText: input.trim(), mode: getMode() });
      }
      setEditingMessage(null);
      setInput('');
      return;
    }

    if (!input.trim() && !imagePreview) return;

    const replyText = replyingTo?.text || (replyingTo?.image ? '📷 사진' : replyingTo?.video ? '🎥 비디오' : '');
    const replyData = replyingTo ? {
      id: replyingTo.id,
      nickname: replyingTo.nickname,
      text: replyText.length > 50 ? replyText.slice(0, 50) + '...' : replyText
    } : null;

    // 비디오/이미지 구분해서 전송
    const isVideo = imagePreview?.type === 'video';
    socket.emit('send-message', {
      roomName,
      text: input.trim(),
      replyTo: replyData,
      image: isVideo ? null : (imagePreview?.data || imagePreview),
      video: isVideo ? imagePreview.data : null,
      mode: getMode()
    });
    socket.emit('typing', { roomName, isTyping: false });
    setInput('');
    setReplyingTo(null);
    setImagePreview(null);
    clearTimeout(typingTimeoutRef.current);
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 비디오인 경우
    if (file.type.startsWith('video/')) {
      // 비디오 크기 제한 (10MB - Socket.io 버퍼 한도)
      if (file.size > 10 * 1024 * 1024) {
        alert('비디오는 10MB 이하만 전송할 수 있어요!\n더 짧게 촬영해주세요.');
        e.target.value = '';
        return;
      }
      // base64로 변환
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview({ type: 'video', data: ev.target.result });
      };
      reader.onerror = () => alert('비디오 처리 실패');
      reader.readAsDataURL(file);
      e.target.value = '';
      return;
    }

    // 이미지인 경우
    if (!file.type.startsWith('image/')) {
      alert('이미지나 비디오 파일만 선택할 수 있어요');
      return;
    }
    try {
      const resized = await resizeImage(file);
      setImagePreview({ type: 'image', data: resized });
    } catch (err) {
      alert('이미지 처리 실패');
    }
    e.target.value = '';
  };

  const handleEmojiClick = (emoji) => {
    setInput(prev => prev + emoji);
  };

  const handleEmojiSend = (emoji) => {
    socket.emit('send-message', { roomName, text: emoji, mode: getMode() });
  };

  const handleStickerSend = (sticker) => {
    socket.emit('send-message', { roomName, sticker: sticker.emoji, mode: getMode() });
    setShowStickers(false);
  };

  const handleCommandClick = (command) => {
    setInput(command + ' ');
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const handleKick = (targetId) => {
    const targetUser = roomUsers.find(u => u.id === targetId);
    if (targetUser && confirm(`${targetUser.nickname}님을 추방하시겠습니까?`)) {
      socket.emit('kick-user', { roomName, targetId, mode: getMode() });
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const handleEdit = (message) => {
    setEditingMessage(message);
    setInput(message.text);
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleDelete = (message) => {
    if (confirm('이 메시지를 삭제하시겠습니까?')) {
      socket.emit('delete-message', { roomName, messageId: message.id, mode: getMode() });
    }
  };

  const handleReact = (messageId, emoji) => {
    socket.emit('react-message', { roomName, messageId, emoji, mode: getMode() });
  };

  const handleVoiceSend = (audioData, duration) => {
    setShowVoiceRecorder(false);
    socket.emit('send-message', {
      roomName,
      audio: audioData,
      audioDuration: duration,
      mode: getMode()
    });
  };

  const handleDeleteRoom = () => {
    if (confirm(`⚠️ "${roomName}" 방을 정말 삭제하시겠습니까?\n\n모든 메시지가 사라지고 되돌릴 수 없어요!`)) {
      if (confirm(`정말 확실해요?\n\n방에 있는 모든 사람이 쫓겨납니다.`)) {
        socket.emit('delete-room', { roomName, mode: getMode() });
      }
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem('imparter-sound', next ? 'on' : 'off');
  };

  const filteredMessages = searchQuery
    ? messages.filter(m =>
        m.type === 'message' &&
        !m.deleted &&
        (m.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         m.nickname?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : messages;

  return (
    <div className="chatroom-container">
      <PartyEffect trigger={partyTrigger} />
      <div className="stars-bg" />

      <div className="chatroom-header">
        <button className="back-btn" onClick={onLeave}>←</button>
        <div className="chatroom-title">
          <h3>{roomName.startsWith('__claude__') ? '🤖 클로드와 1:1' : roomName}</h3>
          <span className="user-count">
            {roomName.startsWith('__claude__')
              ? '✨ AI 친구 (질문 뭐든 OK)'
              : connected ? `${roomUsers.length}명 접속 중` : '🔄 재연결 중...'}
          </span>
        </div>
        <button className="icon-header-btn" onClick={() => setShowSearch(!showSearch)} title="검색">
          🔍
        </button>
        <button className="icon-header-btn" onClick={toggleTheme} title="테마">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="icon-header-btn" onClick={toggleSound} title={soundOn ? '알림 켜짐' : '알림 꺼짐'}>
          {soundOn ? '🔔' : '🔕'}
        </button>
        <button className="users-toggle-btn" onClick={() => setShowUsers(!showUsers)}>
          👥 {roomUsers.length}
        </button>
      </div>

      {showSearch && (
        <div className="search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="메시지 검색..."
            autoFocus
          />
          {searchQuery && (
            <span className="search-count">{filteredMessages.length}개 찾음</span>
          )}
          <button className="search-close-btn" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>✕</button>
        </div>
      )}

      {showUsers && (
        <div className="users-panel">
          <div className="users-panel-header">
            <span>접속 중인 엘프</span>
            <button className="users-close-btn" onClick={() => setShowUsers(false)}>✕</button>
          </div>
          {isOwner && !roomName.startsWith('__claude__') && (
            <div className="user-item">
              <span className="user-item-icon">🗑️</span>
              <span className="user-item-name" style={{ color: '#ff6666' }}>방 삭제</span>
              <button className="kick-btn" onClick={handleDeleteRoom} style={{ background: '#b33333' }}>
                삭제
              </button>
            </div>
          )}
          {roomUsers.map((u) => (
            <div key={u.id} className="user-item">
              <span className="user-item-icon">{u.icon?.emoji || '✨'}</span>
              <span className="user-item-name">
                {u.nickname}
                {u.nickname === ownerId && <span className="owner-badge">방장</span>}
              </span>
              {isOwner && u.id !== socket.id && (
                <button className="kick-btn" onClick={() => handleKick(u.id)}>
                  추방
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="messages-area">
        {filteredMessages.map((msg, i) => (
          <Message
            key={msg.id || `sys-${i}`}
            message={msg}
            isOwn={msg.userId === socket.id || msg.nickname === user.nickname}
            onReply={handleReply}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
            currentUser={user}
            searchQuery={searchQuery}
          />
        ))}

        {!showSearch && typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-avatar">✨</div>
            <div className="typing-bubble">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
            <span className="typing-text">
              {typingUsers.slice(0, 2).join(', ')}{typingUsers.length > 2 ? ` 외 ${typingUsers.length - 2}명` : ''} 입력 중
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showEmoticons && (
        <div className="emoticon-panel">
          <div className="emoticon-tabs">
            {EMOTICON_CATEGORIES.map((cat, i) => (
              <button
                key={cat.name}
                className={`emoticon-tab ${activeCategory === i ? 'active' : ''}`}
                onClick={() => setActiveCategory(i)}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="emoticon-grid">
            {EMOTICON_CATEGORIES[activeCategory].emojis.map((item) => (
              <button
                key={item.label}
                className="emoticon-item"
                onClick={() => handleEmojiClick(item.emoji)}
                onDoubleClick={() => handleEmojiSend(item.emoji)}
                title={item.label}
              >
                <span className="emoticon-emoji">{item.emoji}</span>
                <span className="emoticon-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showStickers && (
        <div className="sticker-panel">
          <div className="sticker-header">
            <span>🎨 스티커 (클릭해서 전송)</span>
            <button className="users-close-btn" onClick={() => setShowStickers(false)}>✕</button>
          </div>
          <div className="sticker-grid">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                className="sticker-item"
                onClick={() => handleStickerSend(s)}
                title={s.name}
              >
                <span className="sticker-emoji">{s.emoji}</span>
                <span className="sticker-name">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCommands && (
        <div className="commands-panel">
          <div className="commands-header">
            <span>🤖 봇 명령어 (클릭해서 입력)</span>
            <button className="users-close-btn" onClick={() => setShowCommands(false)}>✕</button>
          </div>
          <div className="commands-list">
            {[
              { cmd: '/주사위', desc: '🎲 주사위 굴리기' },
              { cmd: '/동전', desc: '🪙 동전 던지기' },
              { cmd: '/8ball', desc: '🎱 매직 8볼에 질문' },
              { cmd: '/운세', desc: '🔮 오늘의 운세' },
              { cmd: '/칭찬', desc: '💖 칭찬 받기' },
              { cmd: '/날씨', desc: '🌤️ 랜덤 날씨' },
              { cmd: '/랜덤 100', desc: '🎯 0~100 랜덤 숫자' },
              { cmd: '/선택', desc: '🎰 옵션 중 랜덤 (A,B,C)' },
              { cmd: '/투표', desc: '📊 질문|옵션1,옵션2' },
              { cmd: '/레벨', desc: '⭐ 내 레벨 확인' },
              { cmd: '/배지', desc: '🏅 내 배지 목록' },
              { cmd: '/랭킹', desc: '📊 TOP 10 랭킹' },
              { cmd: '/가위바위보 바위', desc: '✊ 가위바위보' },
              { cmd: '/숫자야구', desc: '⚾ 숫자야구 시작' },
              { cmd: '/야구', desc: '⚾ 숫자 추측 (3자리)' },
              { cmd: '/끝말잇기', desc: '🔤 끝말잇기 시작' },
              { cmd: '/말', desc: '🔤 끝말잇기 단어' },
              { cmd: '/호그와트', desc: '🏰 기숙사 배정' },
              { cmd: '/mbti', desc: '🔮 MBTI 뽑기' },
              { cmd: '/뽑기', desc: '🎁 가챠 (레어 확률!)' },
              { cmd: '/맛집', desc: '🍽️ 음식 추천' },
              { cmd: '/42', desc: '🌌 우주의 답' },
              { cmd: '/이스터에그', desc: '🥚 숨겨진 명령어' },
              { cmd: '/도움말', desc: '📖 전체 명령어' },
            ].map(c => (
              <button
                key={c.cmd}
                className="command-item"
                onClick={() => handleCommandClick(c.cmd)}
              >
                <span className="command-name">{c.cmd}</span>
                <span className="command-desc">{c.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="reply-bar">
          <div className="reply-bar-info">
            <span className="reply-bar-label">↩️ {replyingTo.nickname}님에게 답장</span>
            <span className="reply-bar-text">{replyingTo.text || '📷 사진'}</span>
          </div>
          <button className="reply-bar-close" onClick={() => setReplyingTo(null)}>✕</button>
        </div>
      )}

      {editingMessage && (
        <div className="reply-bar edit-bar">
          <div className="reply-bar-info">
            <span className="reply-bar-label">✏️ 메시지 수정 중</span>
            <span className="reply-bar-text">{editingMessage.text}</span>
          </div>
          <button className="reply-bar-close" onClick={() => { setEditingMessage(null); setInput(''); }}>✕</button>
        </div>
      )}

      {imagePreview && (
        <div className="image-preview-bar">
          {imagePreview.type === 'video' ? (
            <video src={imagePreview.data} style={{ maxHeight: 80, maxWidth: 120, borderRadius: 10 }} controls />
          ) : (
            <img src={imagePreview.data || imagePreview} alt="미리보기" />
          )}
          <button className="image-preview-close" onClick={() => setImagePreview(null)}>✕</button>
        </div>
      )}

      {showVoiceRecorder && (
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      <form className="message-input-area" onSubmit={handleSend}>
        <button
          type="button"
          className={`emoji-toggle-btn ${showEmoticons ? 'active' : ''}`}
          onClick={() => { setShowEmoticons(!showEmoticons); setShowStickers(false); setShowCommands(false); }}
          title="이모티콘"
        >
          😊
        </button>
        <button
          type="button"
          className={`emoji-toggle-btn ${showStickers ? 'active' : ''}`}
          onClick={() => { setShowStickers(!showStickers); setShowEmoticons(false); setShowCommands(false); }}
          title="스티커"
        >
          🎨
        </button>
        <button
          type="button"
          className={`emoji-toggle-btn ${showCommands ? 'active' : ''}`}
          onClick={() => { setShowCommands(!showCommands); setShowEmoticons(false); setShowStickers(false); }}
          title="봇 명령어"
        >
          🤖
        </button>
        <button
          type="button"
          className="image-btn"
          onClick={() => fileInputRef.current?.click()}
          title="사진 보내기"
        >
          📷
        </button>
        <button
          type="button"
          className="image-btn"
          onClick={() => videoInputRef.current?.click()}
          title="비디오 촬영/전송"
        >
          🎥
        </button>
        <button
          type="button"
          className="image-btn"
          onClick={() => setShowVoiceRecorder(true)}
          title="음성 메시지"
        >
          🎤
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder={editingMessage ? '수정할 내용...' : '메시지를 입력하세요...'}
          autoFocus
        />
        <button type="submit" className="send-btn" disabled={!input.trim() && !imagePreview && !editingMessage}>
          {editingMessage ? '✓' : '✨'}
        </button>
      </form>
    </div>
  );
}
