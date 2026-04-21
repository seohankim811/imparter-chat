import React, { useEffect, useRef } from 'react';
import { getMode } from '../mode';

export default function ParticleBackground({ theme }) {
  const canvasRef = useRef(null);
  const mode = getMode();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let particles = [];

    const themeColors = {
      cosmos: ['#ffffff', '#c8dcff', '#a0b0ff', '#d8c8ff'],
      light: ['#9070d8', '#7090d8', '#a0a0e0', '#b0b0d0'],
      pink: ['#ffb0d0', '#ff80b0', '#ffc0e0', '#ff90c0'],
      neon: ['#00ffaa', '#00aaff', '#ff00ff', '#ffff00'],
      forest: ['#80ffa0', '#a0ff80', '#60d090', '#90e0a0'],
      ocean: ['#80c0ff', '#a0e0ff', '#60a0e0', '#b0d0ff'],
    };

    // 일반(canva) 모드: 비눗방울 스타일 (큰 원이 올라감)
    const canvaColors = ['#ffd6e8', '#d6e8ff', '#e8ffd6', '#ffe8d6', '#e8d6ff'];
    const colors = mode === 'canva' ? canvaColors : (themeColors[theme] || themeColors.cosmos);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const initParticles = () => {
      if (mode === 'canva') {
        // 캔바: 큰 비눗방울들이 천천히 위로 떠오름
        const count = Math.min(20, Math.floor((canvas.width * canvas.height) / 50000));
        particles = [];
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.15,
            vy: -(Math.random() * 0.3 + 0.1),
            size: Math.random() * 40 + 20,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: Math.random() * 0.25 + 0.15,
            twinkle: 0,
          });
        }
      } else {
        // 잃도수: 별빛 파티클
        const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
        particles = [];
        for (let i = 0; i < count; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: Math.random() * 0.6 + 0.2,
            twinkle: Math.random() * Math.PI * 2,
          });
        }
      }
    };
    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.twinkle += 0.02;

        // 캔바 모드: 위로 떠오르다 사라지면 아래에서 재생성
        if (mode === 'canva') {
          if (p.y < -p.size) {
            p.y = canvas.height + p.size;
            p.x = Math.random() * canvas.width;
          }
          if (p.x < -p.size) p.x = canvas.width + p.size;
          if (p.x > canvas.width + p.size) p.x = -p.size;

          // 비눗방울 (큰 원, 은은한 그라디언트)
          const gradient = ctx.createRadialGradient(p.x - p.size/3, p.y - p.size/3, 0, p.x, p.y, p.size);
          gradient.addColorStop(0, p.color);
          gradient.addColorStop(0.7, p.color);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        // 잃도수 모드: 기존 별빛
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const sparkle = Math.sin(p.twinkle) * 0.3 + 0.7;
        const opacity = p.opacity * sparkle;

        ctx.beginPath();
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = opacity * 0.5;
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = opacity;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 120) * 0.15 * opacity;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [theme, mode]);

  return <canvas ref={canvasRef} className="particle-canvas" />;
}
