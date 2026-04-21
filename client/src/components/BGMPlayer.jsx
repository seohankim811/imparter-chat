import React, { useEffect, useRef, useState } from 'react';

// Web Audio API로 lo-fi 분위기 멜로디 생성 (외부 파일 없이)
export default function BGMPlayer({ enabled }) {
  const ctxRef = useRef(null);
  const intervalRef = useRef(null);
  const masterGainRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const start = () => {
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // 마스터 볼륨
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.06, ctx.currentTime);
      master.connect(ctx.destination);
      masterGainRef.current = master;

      // 펜타토닉 스케일 (편안한 분위기)
      const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      let step = 0;

      const playNote = () => {
        if (!ctxRef.current) return;
        const t = ctxRef.current.currentTime;
        const freq = notes[Math.floor(Math.random() * notes.length)];

        const osc = ctxRef.current.createOscillator();
        const gain = ctxRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 1.6);

        // 가끔 화음 추가
        if (Math.random() < 0.4) {
          const osc2 = ctxRef.current.createOscillator();
          const gain2 = ctxRef.current.createGain();
          osc2.type = 'triangle';
          osc2.frequency.value = freq * 0.5;
          gain2.gain.setValueAtTime(0, t);
          gain2.gain.linearRampToValueAtTime(0.25, t + 0.1);
          gain2.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
          osc2.connect(gain2);
          gain2.connect(master);
          osc2.start(t);
          osc2.stop(t + 1.9);
        }

        step++;
      };

      // 일정 간격으로 노트 재생
      intervalRef.current = setInterval(playNote, 1100);
      playNote();
    } catch (e) {
      console.error('BGM 시작 실패:', e);
    }
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (masterGainRef.current && ctxRef.current) {
      try {
        masterGainRef.current.gain.exponentialRampToValueAtTime(0.001, ctxRef.current.currentTime + 0.3);
      } catch (e) {}
    }
  };

  return null;
}
