'use client';

import { useMemo } from 'react';
import {
  dateToJD,
  lst,
  raDecToAltAz,
  sunPosition,
  moonPosition,
  moonPhaseName,
  hoursToHMS,
} from '@/lib/astronomy';
import { STARS } from '@/lib/stars';

interface InfoPanelProps {
  simulationDate: Date;
  latitude: number;
  longitude: number;
  playbackSpeed: number;
  isPlaying: boolean;
}

export default function InfoPanel({
  simulationDate,
  latitude,
  longitude,
  playbackSpeed,
  isPlaying,
}: InfoPanelProps) {
  const info = useMemo(() => {
    const jd = dateToJD(simulationDate);
    const localST = lst(jd, longitude);

    const sun = sunPosition(jd);
    const sunAlt = raDecToAltAz(sun.ra, sun.dec, latitude, localST);

    const moon = moonPosition(jd);
    const moonAlt = raDecToAltAz(moon.ra, moon.dec, latitude, localST);

    let visibleCount = 0;
    for (const star of STARS) {
      const alt = raDecToAltAz(star.ra, star.dec, latitude, localST);
      if (alt.altitude > 0) visibleCount++;
    }

    return {
      localST,
      sunAlt: sunAlt.altitude,
      sunAz: sunAlt.azimuth,
      moonAlt: moonAlt.altitude,
      moonAz: moonAlt.azimuth,
      moonPhase: moon.phase,
      visibleCount,
    };
  }, [simulationDate, latitude, longitude]);

  const dateStr = simulationDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const timeStr = simulationDate.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="info-panel glass-panel" id="info-panel">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontSize: '18px' }}>🔭</span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '1px',
              color: 'var(--accent)',
              textShadow: '0 0 8px var(--accent-glow)',
            }}
          >
            PLANETARIUM
          </span>
        </div>

        <InfoRow label="Date" value={dateStr} />
        <InfoRow label="Local Time" value={timeStr} mono />
        <InfoRow label="Sidereal Time" value={hoursToHMS(info.localST)} mono />

        <div style={{ height: '1px', background: 'var(--border-panel)', margin: '2px 0' }} />

        <InfoRow
          label="☀️ Sun Alt"
          value={`${info.sunAlt.toFixed(1)}°`}
          color={info.sunAlt > 0 ? 'var(--accent-warm)' : 'var(--text-secondary)'}
        />
        <InfoRow
          label="☀️ Sun Az"
          value={`${info.sunAz.toFixed(1)}°`}
          color="var(--text-secondary)"
        />

        <div style={{ height: '1px', background: 'var(--border-panel)', margin: '2px 0' }} />

        <InfoRow
          label="🌙 Moon Alt"
          value={`${info.moonAlt.toFixed(1)}°`}
          color={info.moonAlt > 0 ? '#b0bec5' : 'var(--text-secondary)'}
        />
        <InfoRow label="🌙 Phase" value={moonPhaseName(info.moonPhase)} />

        <div style={{ height: '1px', background: 'var(--border-panel)', margin: '2px 0' }} />

        <InfoRow
          label="⭐ Visible Stars"
          value={`${info.visibleCount} / ${STARS.length}`}
          color="var(--accent)"
        />

        {isPlaying && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: playbackSpeed > 0 ? 'var(--success)' : 'var(--accent-warm)',
                boxShadow: `0 0 6px ${playbackSpeed > 0 ? 'var(--success)' : 'var(--accent-warm)'}`,
                animation: 'pulse-glow 1.5s ease infinite',
              }}
            />
            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              {playbackSpeed > 0 ? '▶' : '◀'} ×{Math.abs(playbackSpeed).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 500 }}>{label}</span>
      <span
        style={{
          color: color || 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          fontSize: mono ? '11px' : '12px',
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}
