'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import TimeControls from './TimeControls';
import VideoControls from './VideoControls';
import InfoPanel from './InfoPanel';

const SkyDome = dynamic(() => import('./SkyDome'), { ssr: false });

const DEFAULT_LAT = 13.75;
const DEFAULT_LON = 100.52;

export default function PlanetariumApp() {
  const [simulationDate, setSimulationDate] = useState<Date>(new Date());
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showConstellations, setShowConstellations] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [latitude] = useState<number>(DEFAULT_LAT);
  const [longitude] = useState<number>(DEFAULT_LON);
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [videoFormat, setVideoFormat] = useState<'fisheye' | 'equirectangular'>('fisheye');
  const [coveLight, setCoveLight] = useState<boolean>(true);
  const [coveColor, setCoveColor] = useState<string>('#aa00ff');
  const [appMode, setAppMode] = useState<'lobby' | 'sky' | 'movie'>('sky');

  const simulationDateRef = useRef(simulationDate);
  const playbackSpeedRef = useRef(playbackSpeed);
  const isPlayingRef = useRef(isPlaying);

  simulationDateRef.current = simulationDate;
  playbackSpeedRef.current = playbackSpeed;
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000; 
      lastTime = now;

      const speed = playbackSpeedRef.current;
      const currentDate = simulationDateRef.current;
      const newDate = new Date(currentDate.getTime() + delta * speed * 1000);
      setSimulationDate(newDate);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  const handleRemoveVideo = () => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setVideoSrc(null);
    setVideoEl(null);
  };

  const onVideoRef = useCallback((node: HTMLVideoElement | null) => {
    setVideoEl(node);
  }, []);

  const handleDateChange = useCallback((date: Date) => {
    setSimulationDate(date);
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div className="loading-text">Initializing Planetarium...</div>
      </div>
    );
  }

  return (
    <div className="planetarium-container" id="planetarium-app">

      {videoSrc && (
        <video
          ref={onVideoRef}
          src={videoSrc}
          crossOrigin="anonymous"
          loop
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />
      )}

      <SkyDome
        simulationDate={simulationDate}
        latitude={latitude}
        longitude={longitude}
        showConstellations={showConstellations}
        showLabels={showLabels}
        appMode={appMode}
        videoElement={videoEl}
        videoFormat={videoFormat}
        coveLight={coveLight}
        coveColor={coveColor}
      />

      <div className="planetarium-overlay">



        <div className="location-badge glass-panel" id="location-badge">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📍</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Bangkok, Thailand</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {latitude.toFixed(2)}°N {longitude.toFixed(2)}°E
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: '80px',
            right: '20px',
            display: 'flex',
            gap: '6px',
            animation: 'fadeIn 0.6s ease 0.5s both',
          }}
        >
          {appMode === 'sky' && (
            <>
              <button
                className={`btn btn-sm ${showConstellations ? 'active' : ''}`}
                onClick={() => setShowConstellations((c) => !c)}
                id="btn-constellations"
              >
                ✦ Lines
              </button>
              <button
                className={`btn btn-sm ${showLabels ? 'active' : ''}`}
                onClick={() => setShowLabels((l) => !l)}
                id="btn-labels"
              >
                Aa Labels
              </button>
            </>
          )}
          
          {appMode !== 'sky' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <label style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, fontWeight: 600 }}>
                <input type="checkbox" checked={coveLight} onChange={(e) => setCoveLight(e.target.checked)} style={{ cursor: 'pointer' }} />
                Cove Light
              </label>
              <input 
                type="color" 
                value={coveColor} 
                onChange={(e) => setCoveColor(e.target.value)} 
                style={{ width: '16px', height: '16px', padding: 0, border: 'none', cursor: 'pointer', borderRadius: '2px', background: 'transparent' }} 
                title="Cove Light Color"
              />
            </div>
          )}
          
          {appMode === 'movie' && (
            <>
              {videoSrc ? (
                <button className="btn btn-sm active" onClick={handleRemoveVideo} style={{ backgroundColor: '#ff4444', color: 'white', borderColor: '#ff4444' }}>
                  ✕ Stop Video
                </button>
              ) : (
                <>
                  <button
                    className={`btn btn-sm ${videoFormat === 'fisheye' ? 'active' : ''}`}
                    onClick={() => setVideoFormat(f => f === 'fisheye' ? 'equirectangular' : 'fisheye')}
                    title="Toggle between Fulldome (Fisheye) and standard 360 (Equirectangular) video formats"
                  >
                    {videoFormat === 'fisheye' ? '⭕ Fisheye' : '🌐 360 EQ'}
                  </button>
                  <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
                    🎥 Load Video
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoUpload} />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          background: 'rgba(10, 10, 15, 0.75)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          padding: '4px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          animation: 'fadeIn 0.6s ease 0.2s both',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          {(['lobby', 'sky', 'movie'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setAppMode(mode)}
              style={{
                background: appMode === mode ? 'var(--accent)' : 'transparent',
                color: appMode === mode ? 'black' : 'white',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {appMode === 'movie' && videoEl && (
          <VideoControls video={videoEl} />
        )}
        
        {appMode === 'sky' && (
          <TimeControls
            simulationDate={simulationDate}
            onDateChange={handleDateChange}
            playbackSpeed={playbackSpeed}
            onSpeedChange={handleSpeedChange}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
          />
        )}
      </div>
    </div>
  );
}
