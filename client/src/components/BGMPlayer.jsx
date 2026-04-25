import React, { useEffect, useRef } from 'react';

// 잔잔한 피아노 BGM - Web Audio API로 진짜 피아노 소리 생성
// C장조 기반 코드 진행 + 멜로디
export default function BGMPlayer({ enabled }) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const timerRef = useRef(null);
  const reverbRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // 피아노 음 만들기 - 여러 harmonics + 감쇠
  const playPianoNote = (ctx, freq, startTime, duration, gain = 0.3) => {
    const output = ctx.createGain();
    output.gain.value = 0;

    // 기본 주파수 + 배음 (피아노 음색)
    const harmonics = [
      { ratio: 1,    gain: 1.0,   decay: 1.0 },
      { ratio: 2,    gain: 0.5,   decay: 0.8 },
      { ratio: 3,    gain: 0.25,  decay: 0.6 },
      { ratio: 4,    gain: 0.15,  decay: 0.4 },
      { ratio: 6,    gain: 0.08,  decay: 0.3 },
    ];

    harmonics.forEach(({ ratio, gain: hGain, decay }) => {
      const osc = ctx.createOscillator();
      const hGainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;

      hGainNode.gain.setValueAtTime(0, startTime);
      hGainNode.gain.linearRampToValueAtTime(hGain, startTime + 0.01);
      hGainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration * decay);

      osc.connect(hGainNode);
      hGainNode.connect(output);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    });

    // ADSR envelope on output
    output.gain.setValueAtTime(0, startTime);
    output.gain.linearRampToValueAtTime(gain, startTime + 0.02);
    output.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    return output;
  };

  const createReverb = (ctx) => {
    // 가벼운 리버브 - 피아노 공간감
    const convolver = ctx.createConvolver();
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  };

  const start = () => {
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.18, ctx.currentTime); // 잔잔하게
      master.connect(ctx.destination);
      masterGainRef.current = master;

      const reverb = createReverb(ctx);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.35;
      reverb.connect(reverbGain);
      reverbGain.connect(master);
      reverbRef.current = reverb;

      // 노트 주파수 (C장조)
      const NOTE = {
        C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
        C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
        G3: 196.00, A3: 220.00, C4_: 261.63, E3: 164.81, F3: 174.61,
      };

      // 잔잔한 코드 진행: C - G - Am - F (8마디 반복)
      const chords = [
        { bass: [NOTE.C4, NOTE.E3], melody: [NOTE.E5, NOTE.G5, NOTE.C5, NOTE.G5] }, // C
        { bass: [NOTE.G3, NOTE.E3], melody: [NOTE.D5, NOTE.G5, NOTE.B4, NOTE.G5] }, // G
        { bass: [NOTE.A3, NOTE.E3], melody: [NOTE.C5, NOTE.E5, NOTE.A4, NOTE.E5] }, // Am
        { bass: [NOTE.F3, NOTE.F3], melody: [NOTE.A4, NOTE.C5, NOTE.F4, NOTE.C5] }, // F
      ];

      let chordIdx = 0;
      let beatInChord = 0;
      const chordDuration = 3.2; // 코드 당 3.2초
      const beatDuration = chordDuration / 4;

      const playNoteToMix = (freq, time, dur, gain) => {
        const noteOut = playPianoNote(ctx, freq, time, dur, gain);
        noteOut.connect(master);
        // 약간의 리버브
        const sendGain = ctx.createGain();
        sendGain.gain.value = 0.3;
        noteOut.connect(sendGain);
        sendGain.connect(reverb);
      };

      const scheduleNext = () => {
        if (!ctxRef.current) return;
        const now = ctxRef.current.currentTime;
        const chord = chords[chordIdx];

        if (beatInChord === 0) {
          // 첫 박에 베이스 + 멜로디
          chord.bass.forEach(f => playNoteToMix(f, now, chordDuration + 0.5, 0.2));
        }

        // 멜로디 (약간 랜덤하게 빠르거나 느리게)
        const melodyNote = chord.melody[beatInChord];
        const noteGain = 0.22 + Math.random() * 0.08;
        const noteDur = beatDuration * (1.5 + Math.random() * 0.8);
        playNoteToMix(melodyNote, now + Math.random() * 0.05, noteDur, noteGain);

        // 가끔 화음 장식음
        if (Math.random() < 0.4) {
          const ornament = chord.melody[(beatInChord + 2) % 4];
          playNoteToMix(ornament, now + beatDuration * 0.5, beatDuration, noteGain * 0.6);
        }

        beatInChord++;
        if (beatInChord >= 4) {
          beatInChord = 0;
          chordIdx = (chordIdx + 1) % chords.length;
        }
      };

      // 첫 노트 즉시 + 비트마다 반복
      scheduleNext();
      timerRef.current = setInterval(scheduleNext, beatDuration * 1000);
    } catch (e) {
      console.error('BGM 시작 실패:', e);
    }
  };

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (masterGainRef.current && ctxRef.current) {
      try {
        masterGainRef.current.gain.exponentialRampToValueAtTime(
          0.001,
          ctxRef.current.currentTime + 0.5
        );
      } catch (e) {}
    }
  };

  return null;
}
