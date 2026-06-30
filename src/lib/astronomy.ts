
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const HOURS2RAD = Math.PI / 12;

export function dateToJD(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    date.getUTCHours() / 24 +
    date.getUTCMinutes() / 1440 +
    date.getUTCSeconds() / 86400 +
    date.getUTCMilliseconds() / 86400000;

  let Y = y;
  let M = m;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }

  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}

export function julianCenturies(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

export function gmst(jd: number): number {
  const T = julianCenturies(jd);

  let theta =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;

  theta = ((theta % 360) + 360) % 360;
  return theta / 15.0; 
}

export function lst(jd: number, lonDeg: number): number {
  const g = gmst(jd);
  let local = g + lonDeg / 15.0;
  return ((local % 24) + 24) % 24;
}

export interface AltAz {
  altitude: number; 
  azimuth: number; 
}

export function raDecToAltAz(
  raHours: number,
  decDeg: number,
  latDeg: number,
  lstHours: number
): AltAz {
  const lat = latDeg * DEG2RAD;
  const dec = decDeg * DEG2RAD;
  const ha = (lstHours - raHours) * HOURS2RAD;

  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = Math.asin(sinAlt);

  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  const sinAz = (-Math.sin(ha) * Math.cos(dec)) / Math.cos(alt);
  let az = Math.atan2(sinAz, cosAz) * RAD2DEG;
  az = ((az % 360) + 360) % 360;

  return { altitude: alt * RAD2DEG, azimuth: az };
}

export function raDecTo3D(
  raHours: number,
  decDeg: number,
  latDeg: number,
  lstHours: number,
  radius: number = 400
): [number, number, number] {
  const { altitude, azimuth } = raDecToAltAz(raHours, decDeg, latDeg, lstHours);
  const alt = altitude * DEG2RAD;
  const az = azimuth * DEG2RAD;

  const x = Math.cos(alt) * Math.cos(az) * radius;
  const y = Math.sin(alt) * radius;
  const z = Math.cos(alt) * Math.sin(az) * radius;

  return [x, y, z];
}

export interface CelestialPosition {
  ra: number; 
  dec: number; 
  altitude?: number;
  azimuth?: number;
}

export function sunPosition(jd: number): CelestialPosition {
  const T = julianCenturies(jd);

  const M = ((357.5291092 + 35999.0502909 * T) % 360 + 360) % 360;
  const Mrad = M * DEG2RAD;

  const C =
    1.9146 * Math.sin(Mrad) +
    0.02 * Math.sin(2 * Mrad) +
    0.0003 * Math.sin(3 * Mrad);

  const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360;

  const sunLon = ((L0 + C) % 360 + 360) % 360;
  const sunLonRad = sunLon * DEG2RAD;

  const obliquity = (23.439291 - 0.0130042 * T) * DEG2RAD;

  const ra = Math.atan2(Math.cos(obliquity) * Math.sin(sunLonRad), Math.cos(sunLonRad));
  const dec = Math.asin(Math.sin(obliquity) * Math.sin(sunLonRad));

  let raHours = ((ra * RAD2DEG) / 15 + 24) % 24;

  return { ra: raHours, dec: dec * RAD2DEG };
}

export function moonPosition(jd: number): CelestialPosition & { phase: number } {
  const T = julianCenturies(jd);

  const L = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360; 
  const M = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360; 
  const F = ((93.2721 + 483202.0175 * T) % 360 + 360) % 360; 
  const D = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360; 
  const Ms = ((357.5291 + 35999.0503 * T) % 360 + 360) % 360; 

  const Lrad = L * DEG2RAD;
  const Mrad = M * DEG2RAD;
  const Frad = F * DEG2RAD;
  const Drad = D * DEG2RAD;
  const Msrad = Ms * DEG2RAD;

  const lon =
    L +
    6.289 * Math.sin(Mrad) +
    1.274 * Math.sin(2 * Drad - Mrad) +
    0.658 * Math.sin(2 * Drad) +
    0.214 * Math.sin(2 * Mrad) -
    0.186 * Math.sin(Msrad) -
    0.114 * Math.sin(2 * Frad);

  const lat =
    5.128 * Math.sin(Frad) +
    0.281 * Math.sin(Mrad + Frad) +
    0.278 * Math.sin(Mrad - Frad);

  const lonRad = ((lon % 360 + 360) % 360) * DEG2RAD;
  const latRad = lat * DEG2RAD;

  const obliquity = (23.439291 - 0.0130042 * T) * DEG2RAD;

  const sinDec =
    Math.sin(latRad) * Math.cos(obliquity) +
    Math.cos(latRad) * Math.sin(obliquity) * Math.sin(lonRad);
  const dec = Math.asin(sinDec);

  const ra = Math.atan2(
    Math.sin(lonRad) * Math.cos(obliquity) - Math.tan(latRad) * Math.sin(obliquity),
    Math.cos(lonRad)
  );

  let raHours = ((ra * RAD2DEG) / 15 + 24) % 24;

  const phase = ((D % 360 + 360) % 360) / 360;

  return { ra: raHours, dec: dec * RAD2DEG, phase };
}

export interface SkyColors {
  zenith: [number, number, number]; 
  horizon: [number, number, number];
  sunGlow: [number, number, number];
  brightness: number; 
}

export function skyColors(sunAltDeg: number): SkyColors {

  const t = Math.max(0, Math.min(1, (sunAltDeg + 18) / 48)); 

  if (sunAltDeg > 10) {

    return {
      zenith: [0.15, 0.45, 0.85],
      horizon: [0.55, 0.75, 0.95],
      sunGlow: [1.0, 0.95, 0.8],
      brightness: 1.0,
    };
  } else if (sunAltDeg > 0) {

    const f = sunAltDeg / 10;
    return {
      zenith: [
        lerp(0.08, 0.15, f),
        lerp(0.15, 0.45, f),
        lerp(0.55, 0.85, f),
      ],
      horizon: [
        lerp(0.85, 0.55, f),
        lerp(0.45, 0.75, f),
        lerp(0.35, 0.95, f),
      ],
      sunGlow: [1.0, lerp(0.6, 0.95, f), lerp(0.3, 0.8, f)],
      brightness: lerp(0.6, 1.0, f),
    };
  } else if (sunAltDeg > -6) {

    const f = (sunAltDeg + 6) / 6;
    return {
      zenith: [
        lerp(0.02, 0.08, f),
        lerp(0.02, 0.15, f),
        lerp(0.15, 0.55, f),
      ],
      horizon: [
        lerp(0.15, 0.85, f),
        lerp(0.08, 0.45, f),
        lerp(0.12, 0.35, f),
      ],
      sunGlow: [lerp(0.4, 1.0, f), lerp(0.15, 0.6, f), lerp(0.1, 0.3, f)],
      brightness: lerp(0.15, 0.6, f),
    };
  } else if (sunAltDeg > -18) {

    const f = (sunAltDeg + 18) / 12;
    return {
      zenith: [
        lerp(0.0, 0.02, f),
        lerp(0.0, 0.02, f),
        lerp(0.02, 0.15, f),
      ],
      horizon: [
        lerp(0.01, 0.15, f),
        lerp(0.01, 0.08, f),
        lerp(0.03, 0.12, f),
      ],
      sunGlow: [lerp(0.05, 0.4, f), lerp(0.02, 0.15, f), lerp(0.05, 0.1, f)],
      brightness: lerp(0.0, 0.15, f),
    };
  } else {

    return {
      zenith: [0.0, 0.0, 0.02],
      horizon: [0.01, 0.01, 0.03],
      sunGlow: [0.0, 0.0, 0.0],
      brightness: 0.0,
    };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function bvToRGB(bv: number): [number, number, number] {
  let r: number, g: number, b: number;

  bv = Math.max(-0.4, Math.min(2.0, bv));

  if (bv < 0.0) {

    r = lerp(0.6, 1.0, (bv + 0.4) / 0.4);
    g = lerp(0.7, 1.0, (bv + 0.4) / 0.4);
    b = 1.0;
  } else if (bv < 0.4) {

    r = 1.0;
    g = lerp(1.0, 0.95, bv / 0.4);
    b = lerp(1.0, 0.85, bv / 0.4);
  } else if (bv < 0.8) {

    r = 1.0;
    g = lerp(0.95, 0.82, (bv - 0.4) / 0.4);
    b = lerp(0.85, 0.55, (bv - 0.4) / 0.4);
  } else if (bv < 1.2) {

    r = 1.0;
    g = lerp(0.82, 0.65, (bv - 0.8) / 0.4);
    b = lerp(0.55, 0.3, (bv - 0.8) / 0.4);
  } else {

    r = lerp(1.0, 0.9, (bv - 1.2) / 0.8);
    g = lerp(0.65, 0.4, (bv - 1.2) / 0.8);
    b = lerp(0.3, 0.15, (bv - 1.2) / 0.8);
  }

  return [r, g, b];
}

export function hoursToHMS(h: number): string {
  h = ((h % 24) + 24) % 24;
  const hours = Math.floor(h);
  const minutes = Math.floor((h - hours) * 60);
  const seconds = Math.floor(((h - hours) * 60 - minutes) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function moonPhaseName(phase: number): string {

  const p = ((phase % 1) + 1) % 1;
  if (p < 0.0625) return "🌑 New Moon";
  if (p < 0.1875) return "🌒 Waxing Crescent";
  if (p < 0.3125) return "🌓 First Quarter";
  if (p < 0.4375) return "🌔 Waxing Gibbous";
  if (p < 0.5625) return "🌕 Full Moon";
  if (p < 0.6875) return "🌖 Waning Gibbous";
  if (p < 0.8125) return "🌗 Last Quarter";
  if (p < 0.9375) return "🌘 Waning Crescent";
  return "🌑 New Moon";
}
