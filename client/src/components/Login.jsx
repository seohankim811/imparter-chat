import React, { useState } from 'react';
import socket from '../socket';
import { getCurrentModeConfig } from '../mode';

export default function Login({ onLogin, theme, toggleTheme }) {
  const mode = getCurrentModeConfig();
  const ICONS = mode.icons;
  const [nickname, setNickname] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    socket.emit('set-user', { nickname: nickname.trim(), icon: selectedIcon });
    onLogin({ nickname: nickname.trim(), icon: selectedIcon });
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
              onChange={(e) => setNickname(e.target.value)}
              placeholder={`${mode.nicknameLabel}을 입력하세요`}
              maxLength={20}
              autoFocus
            />
          </div>

          <button type="submit" className="login-btn" disabled={!nickname.trim()}>
            {mode.joinButtonText}
          </button>
        </form>
      </div>
    </div>
  );
}
