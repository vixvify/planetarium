'use client';

import { useCallback, useMemo } from 'react';

interface TimeControlsProps {
  simulationDate: Date;
  onDateChange: (date: Date) => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const SPEED_OPTIONS = [
  { label: '×1', value: 1 },
  { label: '×10', value: 10 },
  { label: '×60', value: 60 },
  { label: '×200', value: 200 },
  { label: '×360', value: 360 },
  { label: '×3.6k', value: 3600 },
  { label: '×36k', value: 36000 },
];

export default function TimeControls({
  simulationDate,
  onDateChange,
  playbackSpeed,
  onSpeedChange,
  isPlaying,
  onTogglePlay,
}: TimeControlsProps) {

  const dateStr = useMemo(() => {
    const y = simulationDate.getFullYear();
    const m = String(simulationDate.getMonth() + 1).padStart(2, '0');
    const d = String(simulationDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [simulationDate]);

  const timeMinutes = useMemo(() => {
    return simulationDate.getHours() * 60 + simulationDate.getMinutes();
  }, [simulationDate]);

  const timeStr = useMemo(() => {
    const h = String(simulationDate.getHours()).padStart(2, '0');
    const m = String(simulationDate.getMinutes()).padStart(2, '0');
    const s = String(simulationDate.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [simulationDate]);

  const handleDateInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) return;
      const [y, m, d] = val.split('-').map(Number);
      const newDate = new Date(simulationDate);
      newDate.setFullYear(y, m - 1, d);
      onDateChange(newDate);
    },
    [simulationDate, onDateChange]
  );

  const handleTimeSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const mins = parseInt(e.target.value);
      const newDate = new Date(simulationDate);
      newDate.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
      onDateChange(newDate);
    },
    [simulationDate, onDateChange]
  );

  const handleNow = useCallback(() => {
    onDateChange(new Date());
    onSpeedChange(1);
  }, [onDateChange, onSpeedChange]);

  const handleReverse = useCallback(() => {
    onSpeedChange(-Math.abs(playbackSpeed));
  }, [playbackSpeed, onSpeedChange]);

  const handleForward = useCallback(() => {
    onSpeedChange(Math.abs(playbackSpeed));
  }, [playbackSpeed, onSpeedChange]);

  return (
    <div className="time-panel glass-panel" id="time-controls">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '240px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: 600 }}>📅</span>
            <input
              type="date"
              className="input"
              value={dateStr}
              onChange={handleDateInput}
              style={{ width: '90px', fontSize: '10px', padding: '2px 4px' }}
              id="date-picker"
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--accent)',
              letterSpacing: '1px',
              textShadow: '0 0 12px var(--accent-glow)',
            }}
          >
            {timeStr}
          </div>
        </div>

        <div>
          <input
            type="range"
            className="input"
            min={0}
            max={1439}
            value={timeMinutes}
            onChange={handleTimeSlider}
            style={{ width: '100%' }}
            id="time-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>00:00</span>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>12:00</span>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>23:59</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>

          <button
            className="btn btn-icon btn-sm"
            onClick={handleReverse}
            title="Reverse"
            id="btn-reverse"
            style={playbackSpeed < 0 ? { color: 'var(--accent-warm)', borderColor: 'var(--accent-warm)' } : {}}
          >
            ⏪
          </button>

          <button
            className={`btn btn-icon ${isPlaying ? 'active' : ''}`}
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            id="btn-play-pause"
            style={{ fontSize: '14px' }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <button
            className="btn btn-icon btn-sm"
            onClick={handleForward}
            title="Forward"
            id="btn-forward"
            style={playbackSpeed > 0 && playbackSpeed !== 1 ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
          >
            ⏩
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-panel)', margin: '0 2px' }} />

          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`btn btn-sm ${Math.abs(playbackSpeed) === opt.value ? 'active' : ''}`}
              onClick={() => onSpeedChange(playbackSpeed < 0 ? -opt.value : opt.value)}
              id={`btn-speed-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', background: 'var(--border-panel)', margin: '0 2px' }} />

          <button className="btn btn-sm" onClick={handleNow} id="btn-now" style={{ color: 'var(--accent-warm)' }}>
            ⏱ Now
          </button>
        </div>
      </div>
    </div>
  );
}
