import React, { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import Login from './components/Login';
import RoomList from './components/RoomList';
import ChatRoom from './components/ChatRoom';
import GameScreen from './components/GameScreen';
import ParticleBackground from './components/ParticleBackground';
import BGMPlayer from './components/BGMPlayer';
import ProfilePage from './components/ProfilePage';
import UnlockToast from './components/UnlockToast';
import { getMode, getCurrentModeConfig } from './mode';

// localStorage 키에 모드 접미사 (잃도수/일반 완전 분리)
const MODE = getMode();
const USER_KEY = `imparter-user-${MODE}`;
const ROOM_KEY = `imparter-room-${MODE}`;
const THEME_KEY = `imparter-theme-${MODE}`;
const BGM_KEY = `imparter-bgm-${MODE}`;

export default function App() {
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    return stored || getCurrentModeConfig().defaultTheme;
  });
  const [bgmOn, setBgmOn] = useState(() => {
    return localStorage.getItem(BGM_KEY) === 'on';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', MODE);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(BGM_KEY, bgmOn ? 'on' : 'off');
  }, [bgmOn]);

  useEffect(() => {
    const handleReward = ({ gameId, xp, leveledUp, level }) => {
      const gameName = gameId === 'keeper' ? '갓물주 잃도수' : '잃도수 RTS';
      alert(`🎉 첫 플레이 보상!\n${gameName}을(를) 처음 플레이하셨네요!\n+${xp} XP 획득${leveledUp ? `\n🎊 Lv.${level}로 레벨업!` : ''}`);
    };
    socket.on('game-reward', handleReward);
    return () => socket.off('game-reward', handleReward);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      const savedRoom = localStorage.getItem(ROOM_KEY);
      if (saved) {
        const parsedUser = JSON.parse(saved);
        // 현재 모드의 아이콘 리스트에 해당 아이콘이 있는지 확인
        const modeIcons = getCurrentModeConfig().icons;
        const iconValid = parsedUser?.icon && modeIcons.some(i => i.id === parsedUser.icon.id);
        if (parsedUser && parsedUser.nickname && iconValid) {
          setUser(parsedUser);
          socket.emit('set-user', { nickname: parsedUser.nickname, icon: parsedUser.icon });
          if (savedRoom) {
            setCurrentRoom(savedRoom);
          }
        } else {
          // 아이콘이 현재 모드와 안 맞으면 재로그인 강제
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(ROOM_KEY);
        }
      }
    } catch (e) {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ROOM_KEY);
    }
    setLoaded(true);
  }, []);

  const handleLogin = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }, []);

  const handleJoinRoom = useCallback((roomName) => {
    setCurrentRoom(roomName);
    localStorage.setItem(ROOM_KEY, roomName);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setCurrentRoom(null);
    localStorage.removeItem(ROOM_KEY);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setCurrentRoom(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROOM_KEY);
  }, []);

  const toggleTheme = useCallback(() => {
    const themes = ['cosmos', 'light', 'pink', 'neon', 'forest', 'ocean'];
    setTheme(prev => {
      const idx = themes.indexOf(prev);
      return themes[(idx + 1) % themes.length];
    });
  }, []);

  const setSpecificTheme = useCallback((t) => setTheme(t), []);
  const toggleBgm = useCallback(() => setBgmOn(prev => !prev), []);

  const handleOpenGame = useCallback((gameId) => {
    setCurrentGame(gameId);
    const playedKey = `imparter-played-${gameId}`;
    if (!localStorage.getItem(playedKey)) {
      localStorage.setItem(playedKey, '1');
      socket.emit('first-game-play', { gameId });
    }
  }, []);
  const handleCloseGame = useCallback(() => setCurrentGame(null), []);

  const handleOpenProfile = useCallback(() => setShowProfile(true), []);
  const handleCloseProfile = useCallback(() => setShowProfile(false), []);

  if (!loaded) return null;

  if (!user) {
    return (
      <>
        <ParticleBackground theme={theme} />
        <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
      </>
    );
  }

  if (currentGame) {
    return (
      <>
        <GameScreen gameId={currentGame} onBack={handleCloseGame} />
        <UnlockToast />
      </>
    );
  }

  if (showProfile) {
    return (
      <>
        <ParticleBackground theme={theme} />
        <BGMPlayer enabled={bgmOn} />
        <ProfilePage
          user={user}
          theme={theme}
          onSetTheme={setSpecificTheme}
          bgmOn={bgmOn}
          onToggleBgm={toggleBgm}
          onBack={handleCloseProfile}
        />
        <UnlockToast />
      </>
    );
  }

  if (!currentRoom) {
    return (
      <>
        <ParticleBackground theme={theme} />
        <BGMPlayer enabled={bgmOn} />
        <RoomList
          user={user}
          onJoinRoom={handleJoinRoom}
          onLogout={handleLogout}
          onOpenGame={handleOpenGame}
          onOpenProfile={handleOpenProfile}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <UnlockToast />
      </>
    );
  }

  return (
    <>
      <ParticleBackground theme={theme} />
      <BGMPlayer enabled={bgmOn} />
      <ChatRoom
        user={user}
        roomName={currentRoom}
        onLeave={handleLeaveRoom}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <UnlockToast />
    </>
  );
}
