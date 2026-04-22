import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours < 12 ? '오전' : '오후';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${period} ${displayHour}:${minutes}`;
}

// URL을 링크로 + 검색어 하이라이트
function formatText(text, searchQuery) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="msg-link"
        >
          {part}
        </a>
      );
    }
    if (searchQuery) {
      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const subParts = part.split(regex);
      return subParts.map((sub, j) => {
        if (regex.test(sub)) {
          return <mark key={`${i}-${j}`} className="search-highlight">{sub}</mark>;
        }
        return sub;
      });
    }
    return part;
  });
}

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

export default function Message({ message, isOwn, onReply, onReact, onEdit, onDelete, currentUser, searchQuery }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const bubbleRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    // 다음 tick에 등록 (현재 클릭 이벤트가 바로 닫지 않도록)
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  if (message.type === 'system') {
    return (
      <div className="system-message">
        <span>{message.text}</span>
      </div>
    );
  }

  if (message.deleted) {
    return (
      <div className={`message ${isOwn ? 'own' : 'other'}`}>
        {!isOwn && (
          <div className="message-avatar">
            <span className="avatar-emoji">{message.icon?.emoji || '✨'}</span>
          </div>
        )}
        <div className="message-content">
          {!isOwn && <span className="message-nickname">{message.nickname}</span>}
          <div className="message-bubble deleted">
            <p>🚫 삭제된 메시지</p>
          </div>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  const reactions = message.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  // 투표 메시지
  if (message.poll) {
    const poll = message.poll;
    const myVote = poll.votes?.[currentUser?.nickname];
    const totalVotes = Object.keys(poll.votes || {}).length;
    const voteCounts = poll.options.map((_, i) =>
      Object.values(poll.votes || {}).filter(v => v === i).length
    );

    const handleVote = (idx) => {
      socket.emit('vote-poll', {
        roomName: message.roomName || window.__currentRoom,
        messageId: message.id,
        optionIdx: idx,
        mode: window.__currentMode || 'canva'
      });
    };

    return (
      <div className="message other poll-message">
        <div className="message-avatar">
          <span className="avatar-emoji">📊</span>
        </div>
        <div className="message-content">
          <span className="message-nickname">{poll.createdBy}님의 투표</span>
          <div className="poll-bubble">
            <div className="poll-question">📊 {poll.question}</div>
            <div className="poll-options">
              {poll.options.map((opt, i) => {
                const count = voteCounts[i];
                const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                const isMine = myVote === i;
                return (
                  <button
                    key={i}
                    className={`poll-option ${isMine ? 'mine' : ''}`}
                    onClick={() => handleVote(i)}
                  >
                    <div className="poll-option-fill" style={{ width: `${pct}%` }}></div>
                    <div className="poll-option-content">
                      <span className="poll-option-text">
                        {isMine && '✓ '}{opt}
                      </span>
                      <span className="poll-option-count">{count}표 ({pct.toFixed(0)}%)</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="poll-total">총 {totalVotes}명 참여</div>
          </div>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  // 스티커 메시지는 특별한 레이아웃
  if (message.sticker) {
    return (
      <div className={`message ${isOwn ? 'own' : 'other'} sticker-message`}>
        {!isOwn && (
          <div className="message-avatar">
            <span className="avatar-emoji">{message.icon?.emoji || '✨'}</span>
          </div>
        )}
        <div className="message-content">
          {!isOwn && <span className="message-nickname">{message.nickname}</span>}
          <div className="sticker-display">{message.sticker}</div>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`message ${isOwn ? 'own' : 'other'} ${message.isBot ? 'bot-message' : ''}`}>
        {!isOwn && (
          <div className={`message-avatar ${message.isBot ? 'bot-avatar' : ''}`}>
            <span className="avatar-emoji">{message.icon?.emoji || '✨'}</span>
          </div>
        )}
        <div className="message-content">
          {!isOwn && <span className="message-nickname">{message.nickname}</span>}

          {message.replyTo && (
            <div className="reply-preview">
              <span className="reply-nickname">{message.replyTo.nickname}</span>
              <span className="reply-text">{message.replyTo.text}</span>
            </div>
          )}

          <div
            ref={bubbleRef}
            className={`message-bubble ${message.isBot ? 'bot-bubble' : ''}`}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!message.isBot) setShowMenu(!showMenu);
            }}
            onDoubleClick={() => !message.isBot && setShowMenu(!showMenu)}
          >
            {message.image && (
              <img
                src={message.image}
                alt="사진"
                className="message-image"
                loading="lazy"
                onClick={(e) => { e.stopPropagation(); setShowFullImage(true); }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            {message.video && (
              <video
                src={message.video}
                className="message-image"
                controls
                preload="metadata"
                playsInline
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  const parent = e.target.parentNode;
                  if (parent && !parent.querySelector('.video-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'video-fallback';
                    fallback.style.cssText = 'padding:12px;color:#888;font-size:13px;';
                    fallback.innerHTML = '🎥 비디오 (재생 불가)<br/><a href="' + message.video + '" download="video.webm" style="color:#4a9eff;">다운로드</a>';
                    parent.appendChild(fallback);
                  }
                  e.target.style.display = 'none';
                }}
              />
            )}
            {message.audio && (
              <div className="voice-message" onClick={(e) => e.stopPropagation()}>
                <audio src={message.audio} controls preload="metadata" style={{ width: '100%', minWidth: 200 }} />
                {message.audioDuration > 0 && (
                  <span className="voice-duration">🎤 {Math.floor(message.audioDuration / 60)}:{(message.audioDuration % 60).toString().padStart(2, '0')}</span>
                )}
              </div>
            )}
            {message.text && <p style={{ whiteSpace: 'pre-wrap' }}>{formatText(message.text, searchQuery)}</p>}
            {message.edited && <span className="edited-mark">(수정됨)</span>}

            {showMenu && (
              <div className="reaction-picker">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    className="reaction-pick-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact(message.id, emoji);
                      setShowMenu(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  className="reaction-pick-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply(message);
                    setShowMenu(false);
                  }}
                  title="답장"
                >
                  ↩️
                </button>
                {isOwn && !message.image && (
                  <button
                    className="reaction-pick-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(message);
                      setShowMenu(false);
                    }}
                    title="수정"
                  >
                    ✏️
                  </button>
                )}
                {isOwn && (
                  <button
                    className="reaction-pick-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(message);
                      setShowMenu(false);
                    }}
                    title="삭제"
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </div>

          {hasReactions && (
            <div className="reactions-bar">
              {Object.entries(reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  className={`reaction-badge ${users.includes(currentUser?.nickname) ? 'mine' : ''}`}
                  onClick={() => onReact(message.id, emoji)}
                >
                  <span>{emoji}</span>
                  <span className="reaction-count">{users.length}</span>
                </button>
              ))}
            </div>
          )}

          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>
      </div>

      {showFullImage && message.image && (
        <div className="image-modal" onClick={() => setShowFullImage(false)}>
          <img src={message.image} alt="전체보기" />
          <button className="image-modal-close">✕</button>
        </div>
      )}
    </>
  );
}
