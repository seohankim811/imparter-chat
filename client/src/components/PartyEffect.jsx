import React, { useEffect, useRef } from 'react';

// 특정 이모지나 축하 단어 감지해서 파티클 날리기
const PARTY_KEYWORDS = ['🎉', '🎊', '🎂', '🎈', '🥳', '축하', '생일', 'happy birthday', 'congrats', '굿잡', 'gg', '짱'];

export function hasPartyTrigger(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PARTY_KEYWORDS.some(k => text.includes(k) || lower.includes(k.toLowerCase()));
}

export default function PartyEffect({ trigger }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // 중력
        p.rot += p.vrot;
        p.life -= 1;

        if (p.life <= 0 || p.y > canvas.height + 50) return false;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life / 60);
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
        return true;
      });

      if (particlesRef.current.length > 0) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (trigger > 0) {
      // 폭죽 효과!
      const emojis = ['🎉', '🎊', '✨', '⭐', '💖', '🌟', '🎈', '🌈'];
      const count = 60;
      for (let i = 0; i < count; i++) {
        const startX = Math.random() * canvas.width;
        const startY = canvas.height + 20;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
        const speed = 8 + Math.random() * 8;
        particlesRef.current.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.2,
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
          size: 20 + Math.random() * 24,
          life: 120 + Math.random() * 60
        });
      }
      if (!animFrameRef.current) {
        animate();
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="party-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999
      }}
    />
  );
}
