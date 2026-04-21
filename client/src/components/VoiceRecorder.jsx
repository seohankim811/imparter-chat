import React, { useState, useRef, useEffect } from 'react';

export default function VoiceRecorder({ onSend, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    start();
    return () => {
      stop(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
      };
      mr.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (e) {
      alert('마이크 권한이 필요해요! 🎤\n브라우저 설정에서 마이크 허용해주세요.');
      onCancel();
    }
  };

  const stop = (shouldSend) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
        if (shouldSend && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          if (blob.size > 5 * 1024 * 1024) {
            alert('녹음이 너무 길어요! (5MB 이하)');
            onCancel();
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            onSend(reader.result, duration);
          };
          reader.readAsDataURL(blob);
        } else {
          onCancel();
        }
      };
      mediaRecorderRef.current.stop();
    } else {
      onCancel();
    }
    setIsRecording(false);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder-bar">
      <div className="voice-recording-indicator">
        <span className="voice-rec-dot"></span>
        <span>🎤 녹음 중 {formatTime(duration)}</span>
      </div>
      <button type="button" className="voice-cancel-btn" onClick={() => stop(false)}>
        ✕ 취소
      </button>
      <button type="button" className="voice-send-btn" onClick={() => stop(true)}>
        ▶ 전송
      </button>
    </div>
  );
}
