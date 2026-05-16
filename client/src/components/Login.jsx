import React, { useState, useEffect } from 'react';
import socket from '../socket';
import { getCurrentModeConfig } from '../mode';

// 🛡️ 관리자 닉네임(클라이언트에서도 동기) — 서버 ADMIN_NICKNAMES와 일치
const ADMIN_RESERVED = ['서한'];
function normNick(n) {
  return String(n || '')
    .replace(/\s+/g, '')
    .replace(/[._\-~`!@#$%^&*()+=|\\/<>?,"';:\[\]{}]/g, '')
    .replace(/\d+/g, '')
    .toLowerCase();
}
function looksLikeAdminNick(nick) {
  if (!nick) return false;
  const n = normNick(nick);
  if (!n) return false;
  return ADMIN_RESERVED.some(a => normNick(a) === n);
}

export default function Login({ onLogin, theme, toggleTheme }) {
  const mode = getCurrentModeConfig();
  const ICONS = mode.icons;
  const [nickname, setNickname] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [adminSecret, setAdminSecret] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedNick = nickname.trim();
  const needsKey = looksLikeAdminNick(trimmedNick);

  useEffect(() => {
    const onErr = (e) => {
      setSubmitting(false);
      setErrorMsg(e?.message || '로그인 실패');
    };
    const onOk = ({ isAdmin, nickname: serverNick }) => {
      setSubmitting(false);
      setErrorMsg('');
      if (isAdmin) {
        try { sessionStorage.setItem('imparter-admin-key', adminSecret); } catch (_) {}
      }
      onLogin({ nickname: serverNick || trimmedNick, icon: selectedIcon });
    };
    socket.on('login-error', onErr);
    socket.on('login-success', onOk);
    return () => {
      socket.off('login-error', onErr);
      socket.off('login-success', onOk);
    };
  }, [trimmedNick, selectedIcon, adminSecret, onLogin]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!trimmedNick || submitting) return;
    setErrorMsg('');
    setSubmitting(true);
    socket.emit('set-user', {
      nickname: trimmedNick,
      icon: selectedIcon,
      adminSecret: needsKey ? adminSecret : undefined
    });
  };

  return (
    <div className="login-container">
      <div className="stars-bg" />
      {toggleTheme && (
        <button className="login-theme-btn" onClick={toggleTheme} title="테마 전환">
          🎨
        </button>
      )}
      <div className="login-box">
        <div className="login-logo">
          <span className="logo-icon">{mode.appLogo}</span>
          <h1>{mode.appTitle}</h1>
          <p className="login-subtitle">{mode.appSubtitle}</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="icon-selector">
            <p className="icon-label">{mode.avatarLabel}</p>
            <div className="icon-grid">
              {ICONS.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  className={`icon-btn ${selectedIcon.id === icon.id ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                >
                  <span className="icon-emoji">{icon.emoji}</span>
                  <span className="icon-name">{icon.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <input
              type="text"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setErrorMsg(''); }}
              placeholder={`${mode.nicknameLabel}을 입력하세요`}
              maxLength={20}
              autoFocus
            />
          </div>

          {needsKey && (
            <div className="input-group">
              <input
                type="password"
                value={adminSecret}
                onChange={(e) => { setAdminSecret(e.target.value); setErrorMsg(''); }}
                placeholder="🔐 관리자 키"
                maxLength={100}
                autoComplete="off"
              />
            </div>
          )}

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              marginBottom: '12px',
              background: 'rgba(255, 80, 80, 0.15)',
              border: '1px solid rgba(255, 80, 80, 0.4)',
              borderRadius: '8px',
              color: '#ff8080',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={submitting || !trimmedNick || (needsKey && !adminSecret)}>
            {submitting ? '인증 중...' : mode.joinButtonText}
          </button>
        </form>
      </div>
    </div>
  );
}
