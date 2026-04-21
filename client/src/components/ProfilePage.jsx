import React, { useState, useEffect } from 'react';
import socket from '../socket';

const BADGE_INFO = {
  first_message: { emoji: '🌱', name: '첫 발자국', desc: '첫 메시지 전송' },
  chatty: { emoji: '💬', name: '수다쟁이', desc: '메시지 100개' },
  veteran: { emoji: '⭐', name: '베테랑', desc: '메시지 500개' },
  legend: { emoji: '👑', name: '전설', desc: '메시지 1000개' },
  photographer: { emoji: '📸', name: '사진작가', desc: '사진 10장' },
  gamer: { emoji: '🎮', name: '게이머', desc: '게임 10번 플레이' },
  winner: { emoji: '🏆', name: '승리자', desc: '게임 5번 승리' },
  night_owl: { emoji: '🦉', name: '올빼미', desc: '새벽 활동' },
  early_bird: { emoji: '🐦', name: '얼리버드', desc: '아침 활동' },
};

const THEMES = [
  { id: 'cosmos', name: '코스모스', emoji: '🌌', color: '#0a0e27' },
  { id: 'light', name: '라이트', emoji: '☀️', color: '#f0f4ff' },
  { id: 'pink', name: '벚꽃', emoji: '🌸', color: '#3a1a2e' },
  { id: 'neon', name: '네온', emoji: '💫', color: '#0a0a1a' },
  { id: 'forest', name: '숲속', emoji: '🌲', color: '#0a2010' },
  { id: 'ocean', name: '바다', emoji: '🌊', color: '#0a1a30' },
];

export default function ProfilePage({ user, theme, onSetTheme, bgmOn, onToggleBgm, onBack }) {
  const [profile, setProfile] = useState(null);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    socket.emit('get-profile', { nickname: user.nickname });
    socket.emit('get-ranking');

    const handleProfile = (p) => setProfile(p);
    const handleRanking = (r) => setRanking(r);

    socket.on('profile-data', handleProfile);
    socket.on('ranking-data', handleRanking);

    return () => {
      socket.off('profile-data', handleProfile);
      socket.off('ranking-data', handleRanking);
    };
  }, [user.nickname]);

  const xpForLevel = (level) => Math.floor(50 * Math.pow(level, 1.5));
  const currentLevelXP = profile ? xpForLevel(profile.level) : 100;
  const xpPercent = profile ? (profile.xp / currentLevelXP) * 100 : 0;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <h2>내 프로필</h2>
      </div>

      <div className="profile-content">
        {/* 프로필 카드 */}
        <div className="profile-card">
          <div className="profile-avatar">{user.icon?.emoji || '✨'}</div>
          <div className="profile-name">{user.nickname}</div>
          {profile && (
            <>
              <div className="profile-level">Lv.{profile.level}</div>
              <div className="profile-xp-bar">
                <div className="profile-xp-fill" style={{ width: `${xpPercent}%` }}></div>
                <span className="profile-xp-text">{profile.xp} / {currentLevelXP} XP</span>
              </div>
            </>
          )}
        </div>

        {/* 통계 */}
        {profile && (
          <div className="profile-stats">
            <div className="stat-card">
              <div className="stat-num">{profile.messageCount || 0}</div>
              <div className="stat-label">📝 메시지</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{profile.imageCount || 0}</div>
              <div className="stat-label">📷 사진</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{profile.gamesPlayed || 0}</div>
              <div className="stat-label">🎮 게임</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{profile.gamesWon || 0}</div>
              <div className="stat-label">🏆 승리</div>
            </div>
          </div>
        )}

        {/* 배지 */}
        <div className="profile-section">
          <h3>🏅 배지</h3>
          <div className="badges-grid">
            {Object.entries(BADGE_INFO).map(([key, info]) => {
              const owned = profile?.badges?.includes(key);
              return (
                <div key={key} className={`badge-item ${owned ? 'owned' : 'locked'}`} title={info.desc}>
                  <div className="badge-emoji">{owned ? info.emoji : '🔒'}</div>
                  <div className="badge-name">{info.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 테마 선택 */}
        <div className="profile-section">
          <h3>🎨 테마</h3>
          <div className="themes-grid">
            {THEMES.map(t => (
              <button
                key={t.id}
                className={`theme-card ${theme === t.id ? 'active' : ''}`}
                onClick={() => onSetTheme(t.id)}
                style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}dd)` }}
              >
                <span className="theme-emoji">{t.emoji}</span>
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 사운드 설정 */}
        <div className="profile-section">
          <h3>🎵 배경 음악</h3>
          <button className={`bgm-toggle ${bgmOn ? 'on' : ''}`} onClick={onToggleBgm}>
            {bgmOn ? '🔊 BGM 켜짐' : '🔇 BGM 꺼짐'}
          </button>
        </div>

        {/* 랭킹 */}
        <div className="profile-section">
          <h3>📊 랭킹 TOP 10</h3>
          <div className="ranking-list">
            {ranking.length === 0 && <div className="empty-msg">아직 랭킹이 없어요</div>}
            {ranking.map((p, i) => (
              <div key={p.nickname} className={`ranking-item ${p.nickname === user.nickname ? 'me' : ''}`}>
                <span className="rank-medal">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span className="rank-name">{p.nickname}</span>
                <span className="rank-level">Lv.{p.level}</span>
                <span className="rank-xp">{p.xp} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
