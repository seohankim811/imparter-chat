import React, { useEffect, useState, useRef } from 'react';
import socket from '../socket';
import { unlocksFromBadge, unlocksFromLevel } from '../unlocks';

// 화면 우상단에 떠오르는 잠금 해제/배지/레벨업 축하 토스트.
// 서버의 'unlock-celebration' 이벤트를 받아 큐에 쌓고 하나씩 보여준다.
export default function UnlockToast() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const idRef = useRef(0);

  useEffect(() => {
    const onCelebration = (payload) => {
      const id = ++idRef.current;
      let toast;
      if (payload.type === 'level') {
        const unlocks = unlocksFromLevel(payload.level);
        toast = {
          id,
          kind: 'level',
          title: `🎊 Lv.${payload.level} 달성!`,
          subtitle: '레벨업 했어요',
          unlocks
        };
      } else if (payload.type === 'badge') {
        const unlocks = unlocksFromBadge(payload.badgeKey);
        toast = {
          id,
          kind: 'badge',
          title: `🏅 새 배지: ${payload.emoji} ${payload.name}`,
          subtitle: '배지를 획득했어요',
          unlocks
        };
      }
      if (toast) setQueue((q) => [...q, toast]);
    };
    socket.on('unlock-celebration', onCelebration);
    return () => socket.off('unlock-celebration', onCelebration);
  }, []);

  // 큐에서 꺼내서 하나씩 보여주기
  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setCurrent(next);
    const timer = setTimeout(() => setCurrent(null), 4500);
    return () => clearTimeout(timer);
  }, [queue, current]);

  if (!current) return null;

  return (
    <div className="unlock-toast" key={current.id}>
      <div className="unlock-toast-glow" />
      <div className="unlock-toast-title">{current.title}</div>
      <div className="unlock-toast-subtitle">{current.subtitle}</div>
      {current.unlocks && current.unlocks.length > 0 && (
        <div className="unlock-toast-unlocks">
          <div className="unlock-toast-unlocks-label">🔓 새 기능 잠금 해제!</div>
          {current.unlocks.map((u) => (
            <div key={u.key} className="unlock-toast-unlock-item">{u.name}</div>
          ))}
        </div>
      )}
      <button
        className="unlock-toast-close"
        onClick={() => setCurrent(null)}
        title="닫기"
      >×</button>
    </div>
  );
}
