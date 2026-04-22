import React, { useState, useRef, useEffect } from 'react';

export default function VideoRecorder({ onSend, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    initCamera();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error('카메라 접근 실패:', e);
      setErrorMsg('카메라 권한이 필요해요! 🎥\n브라우저 주소창 왼쪽 자물쇠 아이콘 → 카메라 허용');
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    try {
      // 가능한 mimeType 찾기
      const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';

      const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      mr.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration(d => {
          // 자동 중지: 30초
          if (d >= 30) {
            stopRecording();
            return 30;
          }
          return d + 1;
        });
      }, 1000);
    } catch (e) {
      console.error('녹화 시작 실패:', e);
      setErrorMsg('녹화를 시작할 수 없어요: ' + e.message);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSend = () => {
    if (!previewBlob) return;
    if (previewBlob.size > 10 * 1024 * 1024) {
      alert('비디오가 너무 커요! (10MB 이하만 가능)\n더 짧게 찍어주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onSend(reader.result);
      cleanup();
    };
    reader.readAsDataURL(previewBlob);
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setDuration(0);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (errorMsg) {
    return (
      <div className="video-recorder-overlay">
        <div className="video-recorder-box">
          <div style={{ color: '#ff6b6b', padding: 20, textAlign: 'center', whiteSpace: 'pre-line' }}>
            ⚠️ {errorMsg}
          </div>
          <button className="voice-cancel-btn" onClick={onCancel}>닫기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-recorder-overlay">
      <div className="video-recorder-box">
        <div className="video-recorder-header">
          🎥 비디오 녹화
          {isRecording && <span className="video-rec-indicator"><span className="voice-rec-dot"></span>{formatTime(duration)} / 0:30</span>}
        </div>

        {!previewUrl ? (
          <video
            ref={videoRef}
            className="video-recorder-preview"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <video
            src={previewUrl}
            className="video-recorder-preview"
            controls
            autoPlay
          />
        )}

        <div className="video-recorder-controls">
          {!previewUrl ? (
            <>
              <button type="button" className="voice-cancel-btn" onClick={() => { cleanup(); onCancel(); }}>
                ✕ 취소
              </button>
              {!isRecording ? (
                <button type="button" className="video-record-btn" onClick={startRecording}>
                  ⏺ 녹화 시작
                </button>
              ) : (
                <button type="button" className="video-stop-btn" onClick={stopRecording}>
                  ⏹ 녹화 중지
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className="voice-cancel-btn" onClick={handleRetake}>
                🔄 다시 찍기
              </button>
              <button type="button" className="voice-send-btn" onClick={handleSend}>
                ✈️ 전송
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
