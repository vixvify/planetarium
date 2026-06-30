'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import TimeControls from './TimeControls';
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

      <SkyDome
        simulationDate={simulationDate}
        latitude={latitude}
        longitude={longitude}
        showConstellations={showConstellations}
        showLabels={showLabels}
      />

      <div className="planetarium-overlay">

        <InfoPanel
          simulationDate={simulationDate}
          latitude={latitude}
          longitude={longitude}
          playbackSpeed={playbackSpeed}
          isPlaying={isPlaying}
        />

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
        </div>

        <TimeControls
          simulationDate={simulationDate}
          onDateChange={handleDateChange}
          playbackSpeed={playbackSpeed}
          onSpeedChange={handleSpeedChange}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
        />
      </div>
    </div>
  );
}
