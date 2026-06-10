import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { getMode } from '../mode';
import VoiceRecorder from './VoiceRecorder';
import VideoRecorder from './VideoRecorder';
import PartyEffect, { hasPartyTrigger } from './PartyEffect';
import { isUnlocked, getLockMessage } from '../unlocks';
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

    // 카카오톡 스타일 3톤 알림
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0.7, now); // 훨씬 큰 볼륨

    const tones = [
      { freq: 880, start: 0,    dur: 0.12 }, // A5
      { freq: 1318, start: 0.1, dur: 0.15 }, // E6
      { freq: 1760, start: 0.22, dur: 0.25 }, // A6
    ];

    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.8, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });

    // 진동! (핸드폰에서만 작동)
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 200]); // 딩-딩-디잉
    }
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
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [filePreview, setFilePreview] = useState(null); // { name, size, type, data }
  const [myProfile, setMyProfile] = useState(null);
  const [partyTrigger, setPartyTrigger] = useState(0);
  // 친구 초대
  const [showInvite, setShowInvite] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [manualInviteNick, setManualInviteNick] = useState('');
  // 시간대별 비번 스케줄
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedule, setSchedule] = useState([]); // [{start, end, password, label}]
  const [scheduleActiveLabel, setScheduleActiveLabel] = useState(null);
  const [newSlot, setNewSlot] = useState({ start: '18:00', end: '22:00', password: '', label: '' });
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachInputRef = useRef(null);
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
      // 관리자 재접속 시 sessionStorage의 키 같이 전송 (안 그러면 인증 깨져서 서버가 user를 잃어버림)
      let adminSecret;
      try { adminSecret = sessionStorage.getItem('imparter-admin-key') || undefined; } catch (_) {}
      socket.emit('set-user', { nickname: user.nickname, icon: user.icon, mode: getMode(), adminSecret });
      socket.emit('join-room', roomName, { mode: getMode() });
      socket.emit('get-profile', { nickname: user.nickname });
    };

    joinRoom();

    socket.on('connect', () => {
      setConnected(true);
      joinRoom();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('profile-data', (p) => {
      if (p && p.nickname === user.nickname) {
        setMyProfile(p);
      }
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
      // 🎉 파티 효과 트리거! (잠금 해제된 사람만)
      if (!isFirstLoad.current && hasPartyTrigger(msg.text) && isUnlocked('party_effect', myProfile)) {
        setPartyTrigger(t => t + 1);
      }
      // 내 메시지면 프로필 갱신 (XP/배지 업데이트)
      if (msg.nickname === user.nickname && !msg.isBot) {
        setTimeout(() => socket.emit('get-profile', { nickname: user.nickname }), 300);
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

    socket.on('room-owner', (payload) => {
      // 기존: 문자열만 / 신규: { ownerNickname, isOwner }
      const ownerNick = typeof payload === 'string' ? payload : payload?.ownerNickname || null;
      const canManage = typeof payload === 'object' && payload !== null && payload.isOwner !== undefined
        ? !!payload.isOwner
        : ownerNick === user.nickname;
      setOwnerId(ownerNick);
      setIsOwner(canManage);
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

    // 친구 초대
    socket.on('online-users-list', (list) => {
      setOnlineUsers(Array.isArray(list) ? list : []);
    });
    socket.on('invite-success', ({ targetNickname }) => {
      alert(`✅ ${targetNickname}님에게 초대장을 보냈어요!`);
    });
    socket.on('invite-error', ({ message }) => {
      alert('⚠️ ' + (message || '초대 실패'));
    });

    // 시간대별 비번 스케줄
    socket.on('room-schedule-data', ({ schedule: s, activeLabel }) => {
      setSchedule(Array.isArray(s) ? s : []);
      setScheduleActiveLabel(activeLabel || null);
    });
    socket.on('room-schedule-updated', ({ success, schedule: s }) => {
      if (success) {
        setSchedule(Array.isArray(s) ? s : []);
        alert('✅ 시간대별 비번 저장됨!');
      }
    });
    socket.on('room-schedule-error', ({ message }) => {
      alert('⚠️ ' + (message || '스케줄 저장 실패'));
    });

    return () => {
      clearTimeout(firstLoadTimeout);
      clearTimeout(typingTimeoutRef.current);
      socket.emit('leave-room', roomName, { mode: getMode() });
      socket.off('connect');
      socket.off('disconnect');
      socket.off('profile-data');
      socket.off('room-history');
      socket.off('new-message');
      socket.off('message-updated');
      socket.off('system-message');
      socket.off('room-users');
      socket.off('room-owner');
      socket.off('kicked');
      socket.off('room-deleted');
      socket.off('room-schedule-data');
      socket.off('room-schedule-updated');
      socket.off('room-schedule-error');
      socket.off('online-users-list');
      socket.off('invite-success');
      socket.off('invite-error');
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

    if (!input.trim() && !imagePreview && !filePreview) return;

    const replyText = replyingTo?.text || (replyingTo?.image ? '📷 사진' : replyingTo?.video ? '🎥 비디오' : replyingTo?.file ? `📎 ${replyingTo.file.name}` : '');
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
      file: filePreview || null,
      mode: getMode()
    });
    socket.emit('typing', { roomName, isTyping: false });
    setInput('');
    setReplyingTo(null);
    setImagePreview(null);
    setFilePreview(null);
    clearTimeout(typingTimeoutRef.current);
  };

  const handleFileAttach = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('파일은 10MB 이하만 보낼 수 있어요.');
      e.target.value = '';
      return;
    }
    // 실행 파일 차단 (클라이언트 1차)
    if (/\.(exe|bat|cmd|sh|app|dmg|msi|com|vbs|ps1|jar|scr|pif)$/i.test(file.name)) {
      alert('실행 파일은 보낼 수 없어요.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        data: ev.target.result
      });
    };
    reader.onerror = () => alert('파일 읽기 실패');
    reader.readAsDataURL(file);
    e.target.value = '';
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

  // 잠금 기능 클릭 시 안내
  const checkUnlockOrAlert = (featureKey) => {
    if (isUnlocked(featureKey, myProfile)) return true;
    alert(getLockMessage(featureKey));
    return false;
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

  const handleVideoSend = (videoData) => {
    setShowVideoRecorder(false);
    socket.emit('send-message', {
      roomName,
      video: videoData,
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

  // 친구 초대 — 열기
  const handleOpenInvite = () => {
    socket.emit('get-online-users', { mode: getMode() });
    setShowInvite(true);
    setInviteSearch('');
    setManualInviteNick('');
  };
  // 친구 초대 — 전송
  const handleInviteUser = (targetNickname) => {
    if (!targetNickname || !targetNickname.trim()) {
      alert('초대할 친구 닉네임을 입력해주세요');
      return;
    }
    socket.emit('invite-user', {
      targetNickname: targetNickname.trim(),
      roomName,
      mode: getMode()
    });
    setManualInviteNick('');
  };

  // 시간대별 비번 스케줄 — 열기
  const handleOpenSchedule = () => {
    socket.emit('get-room-password-schedule', { roomName, mode: getMode() });
    setShowSchedule(true);
  };
  // 시간 정규화 — "18:00", "18:00:00", "8:0", "08:00" 모두 받음
  const normalizeTime = (t) => {
    if (!t) return null;
    const m = String(t).trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };
  // 슬롯 추가
  const handleAddSlot = () => {
    const start = normalizeTime(newSlot.start);
    const end = normalizeTime(newSlot.end);
    if (!start || !end) {
      alert(`시간 형식이 잘못됐어요. HH:MM (예: 18:00)\n\n입력: 시작="${newSlot.start}", 끝="${newSlot.end}"`);
      return;
    }
    if (!newSlot.password.trim()) {
      alert('비밀번호를 입력해주세요');
      return;
    }
    if (schedule.length >= 10) {
      alert('슬롯은 최대 10개까지 가능해요');
      return;
    }
    const next = [...schedule, {
      start,
      end,
      password: newSlot.password.trim(),
      label: newSlot.label.trim()
    }];
    setSchedule(next);
    setNewSlot({ start: '18:00', end: '22:00', password: '', label: '' });
  };
  // 슬롯 삭제
  const handleRemoveSlot = (idx) => {
    setSchedule(prev => prev.filter((_, i) => i !== idx));
  };
  // 저장
  const handleSaveSchedule = () => {
    socket.emit('set-room-password-schedule', { roomName, schedule, mode: getMode() });
  };
  // 전체 삭제
  const handleClearSchedule = () => {
    if (!confirm('시간대별 비번을 모두 지울까요?')) return;
    setSchedule([]);
    socket.emit('set-room-password-schedule', { roomName, schedule: [], mode: getMode() });
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
          {(() => {
            const personaMatch = roomName.match(/^__persona__([a-z_]+)__/);
            if (personaMatch) {
              const PERSONA_LABELS = {
                sophie: { emoji: '✨', name: 'Sophie Foster', desc: '주인공 엘프와 1:1' },
                keefe: { emoji: '🎨', name: 'Keefe Sencen', desc: '장난꾸러기 Empath와 1:1' },
                fitz: { emoji: '👑', name: 'Fitz Vacker', desc: '완벽한 Vacker와 1:1' },
                biana: { emoji: '💎', name: 'Biana Vacker', desc: 'Vanisher와 1:1' },
                dex: { emoji: '⚙️', name: 'Dex Dizznee', desc: 'Technopath와 1:1' },
                tam: { emoji: '🌑', name: 'Tam Song', desc: 'Shade와 1:1' },
                linh: { emoji: '🌊', name: 'Linh Song', desc: 'Hydrokinetic과 1:1' },
                keefe_dad: { emoji: '💙', name: 'Keefe (진지)', desc: '다정한 Keefe와 1:1' },
              };
              const p = PERSONA_LABELS[personaMatch[1]] || { emoji: '🧝', name: personaMatch[1], desc: '캐릭터 1:1' };
              return (
                <>
                  <h3>{p.emoji} {p.name}</h3>
                  <span className="user-count">{p.desc} · AI 페르소나</span>
                </>
              );
            }
            return (
              <>
                <h3>{(roomName.startsWith('__claude__') || roomName.startsWith('__persona__')) ? '🤖 클로드와 1:1' : roomName}</h3>
                <span className="user-count">
                  {(roomName.startsWith('__claude__') || roomName.startsWith('__persona__'))
                    ? '✨ AI 친구 (질문 뭐든 OK)'
                    : connected ? `${roomUsers.length}명 접속 중` : '🔄 재연결 중...'}
                </span>
              </>
            );
          })()}
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
            <span>{getMode() === 'kotlc' ? '접속 중인 엘프' : '접속 중인 사용자'}</span>
            <button className="users-close-btn" onClick={() => setShowUsers(false)}>✕</button>
          </div>
          {!(roomName.startsWith('__claude__') || roomName.startsWith('__persona__')) && (
            <div className="user-item">
              <span className="user-item-icon">➕</span>
              <span className="user-item-name" style={{ color: '#7eddff' }}>
                친구 초대
              </span>
              <button className="kick-btn" onClick={handleOpenInvite} style={{ background: '#fee500', color: '#1a1a1a' }}>
                초대
              </button>
            </div>
          )}
          {isOwner && !(roomName.startsWith('__claude__') || roomName.startsWith('__persona__')) && (
            <>
              <div className="user-item">
                <span className="user-item-icon">🕐</span>
                <span className="user-item-name" style={{ color: '#9bd8ff' }}>
                  시간대별 비번
                  {scheduleActiveLabel && (
                    <span className="owner-badge" style={{ background: '#0d6efd' }}>
                      활성: {scheduleActiveLabel || 'ON'}
                    </span>
                  )}
                </span>
                <button className="kick-btn" onClick={handleOpenSchedule} style={{ background: '#1f6feb' }}>
                  설정
                </button>
              </div>
              <div className="user-item">
                <span className="user-item-icon">🗑️</span>
                <span className="user-item-name" style={{ color: '#ff6666' }}>방 삭제</span>
                <button className="kick-btn" onClick={handleDeleteRoom} style={{ background: '#b33333' }}>
                  삭제
                </button>
              </div>
            </>
          )}
          {roomUsers.map((u) => (
            <div key={u.id} className="user-item">
              <span className="user-item-icon">{u.icon?.emoji || '✨'}</span>
              <span className="user-item-name">
                {u.nickname}
                {u.nickname === ownerId && <span className="owner-badge">방장</span>}
                {u.nickname === '서한' && u.nickname !== ownerId && (
                  <span className="owner-badge owner-badge-admin">관리자</span>
                )}
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

      {showInvite && (
        <div className="schedule-modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-header">
              <h3>➕ 친구 초대</h3>
              <button className="users-close-btn" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <p className="schedule-help">
              "{roomName}" 방으로 친구를 초대해요. 닉네임으로 직접 초대하거나, 지금 접속 중인
              사람 중에 골라 초대할 수 있어요. 친구한테 알림이 가요!
            </p>

            {/* 닉네임 직접 입력 */}
            <div className="schedule-add-form">
              <div className="schedule-add-row">
                <label>닉네임</label>
                <input
                  type="text"
                  value={manualInviteNick}
                  onChange={(e) => setManualInviteNick(e.target.value)}
                  placeholder="친구 닉네임 입력"
                  maxLength={20}
                />
              </div>
              <button className="schedule-add-btn" onClick={() => handleInviteUser(manualInviteNick)}>
                💌 초대장 보내기
              </button>
            </div>

            {/* 접속 중인 친구 목록 */}
            <div style={{ marginTop: '14px', marginBottom: '8px', fontSize: '13px', opacity: 0.8 }}>
              👥 지금 접속 중인 친구 ({onlineUsers.length}명)
            </div>
            <div className="schedule-add-row" style={{ marginBottom: '10px' }}>
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="이름으로 검색..."
                style={{ flex: 1 }}
              />
            </div>
            {onlineUsers.length === 0 ? (
              <div className="schedule-empty">지금 접속 중인 다른 친구가 없어요</div>
            ) : (
              <div className="schedule-slots" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {onlineUsers
                  .filter(u => !inviteSearch || u.nickname.toLowerCase().includes(inviteSearch.toLowerCase()))
                  .map(u => (
                    <div key={u.nickname} className="schedule-slot-item">
                      <span style={{ fontSize: '18px' }}>{u.icon?.emoji || '✨'}</span>
                      <span className="schedule-label">{u.nickname}</span>
                      <button
                        className="kick-btn"
                        style={{ background: '#fee500', color: '#1a1a1a' }}
                        onClick={() => handleInviteUser(u.nickname)}
                      >
                        초대
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showSchedule && (
        <div className="schedule-modal-overlay" onClick={() => setShowSchedule(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-header">
              <h3>🕐 시간대별 비밀번호 설정</h3>
              <button className="users-close-btn" onClick={() => setShowSchedule(false)}>✕</button>
            </div>
            <p className="schedule-help">
              지정한 시간대에만 그 비번을 요구해요. 예: 저녁 6시~10시는 비번 "fox123",
              밤 10시~새벽 2시는 비번 "moon999". 시간대 밖이면 일반 비번(있으면) 사용.
              <br />⏰ 한국 시간 기준. 자정 넘어가도 OK (예: 22:00~02:00).
            </p>

            {/* 현재 슬롯 목록 */}
            {schedule.length > 0 ? (
              <div className="schedule-slots">
                {schedule.map((slot, idx) => (
                  <div key={idx} className="schedule-slot-item">
                    <span className="schedule-time">⏰ {slot.start} ~ {slot.end}</span>
                    <span className="schedule-pw">🔑 {slot.password}</span>
                    {slot.label && <span className="schedule-label">📝 {slot.label}</span>}
                    <button className="schedule-remove-btn" onClick={() => handleRemoveSlot(idx)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="schedule-empty">아직 추가된 시간대가 없어요</div>
            )}

            {/* 새 슬롯 추가 폼 */}
            <div className="schedule-add-form">
              <div className="schedule-add-row">
                <label>시작</label>
                <input
                  type="time"
                  value={newSlot.start}
                  onChange={(e) => setNewSlot({ ...newSlot, start: e.target.value })}
                />
                <span>~</span>
                <label>끝</label>
                <input
                  type="time"
                  value={newSlot.end}
                  onChange={(e) => setNewSlot({ ...newSlot, end: e.target.value })}
                />
              </div>
              <div className="schedule-add-row">
                <label>비번</label>
                <input
                  type="text"
                  value={newSlot.password}
                  onChange={(e) => setNewSlot({ ...newSlot, password: e.target.value })}
                  placeholder="비밀번호"
                  maxLength={20}
                />
              </div>
              <div className="schedule-add-row">
                <label>메모</label>
                <input
                  type="text"
                  value={newSlot.label}
                  onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })}
                  placeholder="예: 저녁 시간 (선택)"
                  maxLength={20}
                />
              </div>
              <button className="schedule-add-btn" onClick={handleAddSlot}>
                ➕ 슬롯 추가
              </button>
            </div>

            {/* 저장 / 전체 삭제 */}
            <div className="schedule-actions">
              <button className="schedule-save-btn" onClick={handleSaveSchedule}>
                💾 저장
              </button>
              {schedule.length > 0 && (
                <button className="schedule-clear-btn" onClick={handleClearSchedule}>
                  🗑️ 전체 삭제
                </button>
              )}
            </div>
          </div>
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

      {filePreview && (
        <div className="image-preview-bar file-preview-bar">
          <div className="file-preview-icon">📎</div>
          <div className="file-preview-info">
            <div className="file-preview-name">{filePreview.name}</div>
            <div className="file-preview-size">
              {filePreview.size < 1024 ? `${filePreview.size}B`
                : filePreview.size < 1024*1024 ? `${(filePreview.size/1024).toFixed(1)}KB`
                : `${(filePreview.size/1024/1024).toFixed(2)}MB`}
            </div>
          </div>
          <button className="image-preview-close" onClick={() => setFilePreview(null)}>✕</button>
        </div>
      )}

      {showVoiceRecorder && (
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      {showVideoRecorder && (
        <VideoRecorder
          onSend={handleVideoSend}
          onCancel={() => setShowVideoRecorder(false)}
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
          className={`emoji-toggle-btn ${showStickers ? 'active' : ''} ${!isUnlocked('sticker', myProfile) ? 'locked-btn' : ''}`}
          onClick={() => {
            if (!checkUnlockOrAlert('sticker')) return;
            setShowStickers(!showStickers); setShowEmoticons(false); setShowCommands(false);
          }}
          title={isUnlocked('sticker', myProfile) ? '스티커' : '🔒 잠김'}
        >
          {isUnlocked('sticker', myProfile) ? '🎨' : '🔒'}
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
          onClick={() => attachInputRef.current?.click()}
          title="파일 첨부 (10MB 이하)"
        >
          📎
        </button>
        <button
          type="button"
          className={`image-btn ${!isUnlocked('video_message', myProfile) ? 'locked-btn' : ''}`}
          onClick={() => {
            if (!checkUnlockOrAlert('video_message')) return;
            setShowVideoRecorder(true);
          }}
          title={isUnlocked('video_message', myProfile) ? '비디오 촬영/전송' : '🔒 Lv.3 필요'}
        >
          {isUnlocked('video_message', myProfile) ? '🎥' : '🔒'}
        </button>
        <button
          type="button"
          className={`image-btn ${!isUnlocked('voice_message', myProfile) ? 'locked-btn' : ''}`}
          onClick={() => {
            if (!checkUnlockOrAlert('voice_message')) return;
            setShowVoiceRecorder(true);
          }}
          title={isUnlocked('voice_message', myProfile) ? '음성 메시지' : '🔒 베테랑 배지 필요'}
        >
          {isUnlocked('voice_message', myProfile) ? '🎤' : '🔒'}
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
          ref={attachInputRef}
          type="file"
          onChange={handleFileAttach}
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
        <button type="submit" className="send-btn" disabled={!input.trim() && !imagePreview && !filePreview && !editingMessage}>
          {editingMessage ? '✓' : '✨'}
        </button>
      </form>
    </div>
  );
}
