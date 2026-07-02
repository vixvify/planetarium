'use client';

import { useEffect, useState } from 'react';

export default function VideoControls({ video }: { video: HTMLVideoElement | null }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!video) return;

    let animId: number;
    const tick = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    
    setPlaying(!video.paused);

    return () => {
      cancelAnimationFrame(animId);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [video]);

  const togglePlay = () => {
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.currentTime = val;
    setProgress(val);
  };
  
  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!video) return null;

  return (
    <div className="time-panel glass-panel" id="video-controls">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '380px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            {formatTime(progress)} / {formatTime(duration)}
          </div>
        </div>

        <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={progress}
            onChange={handleSeek}
            className="time-slider"
            style={{ width: '100%', margin: 0 }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button className={`btn btn-icon ${playing ? 'active' : ''}`} onClick={togglePlay} style={{ width: '100px' }}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

      </div>
    </div>
  );
}
