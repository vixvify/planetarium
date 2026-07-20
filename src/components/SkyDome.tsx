"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import {
  dateToJD,
  lst,
  raDecTo3D,
  raDecToAltAz,
  sunPosition,
  moonPosition,
  skyColors,
  bvToRGB,
} from "@/lib/astronomy";
import { STARS, CONSTELLATIONS, buildStarNameIndex } from "@/lib/stars";

const DOME_VERTEX_SHADER = `
varying vec3 vWorldPosition;
varying vec2 vUv;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const DOME_FRAGMENT_SHADER = `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uSunDirection;
uniform vec3 uSunGlowColor;
uniform float uBrightness;
uniform vec3 uCoveColor;
uniform float uCoveIntensity;

varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec3 dir = normalize(vWorldPosition);

  float h = max(dir.y, 0.0);
  float hSmooth = pow(h, 0.5);

  vec3 sky = mix(uHorizonColor, uZenithColor, hSmooth);

  // Sun glow removed based on user request
  // float sunDot = max(dot(dir, uSunDirection), 0.0);
  // float sunGlow = pow(sunDot, 6.0) * 0.5;
  // float sunCore = pow(sunDot, 48.0) * 1.5;
  // sky += uSunGlowColor * (sunGlow + sunCore) * uBrightness;

  float horizonFade = 1.0 - smoothstep(0.0, 0.12, h);
  sky += uHorizonColor * horizonFade * 0.2 * uBrightness;

  // Cove Light Effect (adjusted to reach higher up the dome)
  float coveFade = exp(-h * 4.0); 
  sky += uCoveColor * coveFade * uCoveIntensity;

  // Structural dome panels
  float gridU = fract(vUv.x * 36.0);
  float gridV = fract(vUv.y * 10.0);
  float grid = smoothstep(0.02, 0.0, min(gridU, gridV));
  float skyLum = dot(sky, vec3(0.299, 0.587, 0.114));
  sky += vec3(grid * 0.05 * skyLum); // Additive faint white lines, scales with brightness

  float vignette = smoothstep(0.0, 0.6, h);
  sky *= 0.85 + 0.15 * vignette;

  gl_FragColor = vec4(sky, 1.0);
}
`;

const STAR_VERTEX_SHADER = `
attribute float aSize;
attribute vec3 aColor;
attribute float aTwinkle;
uniform float uTime;
uniform float uBrightness;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  float targetAlpha = 1.0 - smoothstep(0.15, 0.6, uBrightness);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float computedSize = aSize * (250.0 / -mvPosition.z);

  float minSize = 2.0;
  if (computedSize < minSize) {
    float ratio = computedSize / minSize;
    vAlpha = targetAlpha * (ratio * ratio);
    gl_PointSize = minSize;
  } else {
    vAlpha = targetAlpha;
    gl_PointSize = computedSize;
  }

  gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  float core = smoothstep(0.5, 0.08, dist);
  float glow = smoothstep(0.5, 0.0, dist) * 0.4;
  float alpha = (core + glow) * vAlpha;

  gl_FragColor = vec4(vColor, alpha);
}
`;

const FADE_VERTEX_SHADER = `
varying vec3 vWorldDirection;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldDirection = normalize(worldPos.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FADE_FRAGMENT_SHADER = `
uniform float uOpacity;
uniform vec3 uCoveColor;
uniform float uCoveIntensity;
varying vec3 vWorldDirection;

void main() {
  vec3 dir = normalize(vWorldDirection);
  float h = max(dir.y, 0.0);
  
  // Base color is black to obscure the video/sky
  vec3 baseColor = vec3(0.005, 0.005, 0.01);
  
  // Cove Light Effect (identical to other shaders)
  float coveFade = exp(-h * 3.5);
  baseColor += uCoveColor * coveFade * (uCoveIntensity * 2.5);
  
  gl_FragColor = vec4(baseColor, uOpacity);
}
`;

const FISHEYE_VERTEX_SHADER = `
varying vec3 vWorldDirection;
varying vec2 vUv;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldDirection = normalize(worldPos.xyz);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LOBBY_FRAGMENT_SHADER = `
uniform vec3 uCoveColor;
uniform float uCoveIntensity;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec3 dir = normalize(vWorldPosition);
  float h = max(dir.y, 0.0);
  
  // A dark subtle base for the lobby dome
  vec3 color = vec3(0.005, 0.005, 0.01);
  
  // Cove Light Effect (adjusted for wider spread and much higher brightness)
  float coveFade = exp(-h * 3.5);
  color += uCoveColor * coveFade * (uCoveIntensity * 2.5);
  
  // Structural dome panels
  float gridU = fract(vUv.x * 36.0);
  float gridV = fract(vUv.y * 10.0);
  float grid = smoothstep(0.02, 0.0, min(gridU, gridV));
  float colorLum = dot(color, vec3(0.299, 0.587, 0.114));
  color += vec3(grid * 0.10 * colorLum); // Additive faint white lines, scales with brightness
  
  gl_FragColor = vec4(color, 1.0);
}
`;

const FISHEYE_FRAGMENT_SHADER = `
uniform sampler2D tVideo;
uniform vec3 uCoveColor;
uniform float uCoveIntensity;
varying vec3 vWorldDirection;
varying vec2 vUv;

#define PI 3.14159265359

void main() {
  vec3 dir = normalize(vWorldDirection);
  
  float altitude = asin(max(0.0, dir.y));
  float r = (1.0 - (altitude / (PI / 2.0))) * 0.5;
  
  float azimuth = atan(dir.z, dir.x);
  
  float u = 0.5 + r * cos(azimuth);
  float v = 0.5 - r * sin(azimuth);
  
  vec3 finalColor = texture2D(tVideo, vec2(u, v)).rgb;
  
  // Cove Light Effect (adjusted for wider spread and much higher brightness)
  float coveFade = exp(-altitude * 3.5);
  finalColor += uCoveColor * coveFade * (uCoveIntensity * 2.5);
  
  // Grid
  float gridU = fract(vUv.x * 36.0);
  float gridV = fract(vUv.y * 10.0);
  float grid = smoothstep(0.02, 0.0, min(gridU, gridV));
  float lum = dot(finalColor, vec3(0.299, 0.587, 0.114));
  finalColor += vec3(grid * 0.10 * lum);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

const EQUIRECTANGULAR_FRAGMENT_SHADER = `
uniform sampler2D tVideo;
uniform vec3 uCoveColor;
uniform float uCoveIntensity;
varying vec3 vWorldDirection;
varying vec2 vUv;

void main() {
  vec2 uv = vec2(vUv.x, vUv.y * 0.5 + 0.5);
  vec3 finalColor = texture2D(tVideo, uv).rgb;
  
  // Cove Light Effect
  vec3 dir = normalize(vWorldDirection);
  float altitude = asin(max(0.0, dir.y));
  float coveFade = exp(-altitude * 3.5);
  finalColor += uCoveColor * coveFade * (uCoveIntensity * 2.5);
  
  // Grid
  float gridU = fract(vUv.x * 36.0);
  float gridV = fract(vUv.y * 10.0);
  float grid = smoothstep(0.02, 0.0, min(gridU, gridV));
  float lum = dot(finalColor, vec3(0.299, 0.587, 0.114));
  finalColor += vec3(grid * 0.10 * lum);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface SkyDomeProps {
  simulationDate: Date;
  latitude: number;
  longitude: number;
  showConstellations: boolean;
  showLabels: boolean;
  showArt?: boolean;
  appMode: "lobby" | "sky" | "movie";
  mediaElement?: HTMLVideoElement | HTMLImageElement | null;
  videoFormat?: "fisheye" | "equirectangular";
  coveLight?: boolean;
  coveColor?: string;
  wallLight?: boolean;
  onSlewingChange?: (isSlewing: boolean) => void;
}

const DOME_RADIUS = 80;
const DOME_HEIGHT = 95;
const WALL_HEIGHT = 25;
const ROOM_RADIUS = DOME_RADIUS;
const FLOOR_Y = -WALL_HEIGHT;
const SEAT_ROWS = 8;
const PROJECTOR_HEIGHT = 12;

export default function SkyDome({
  simulationDate,
  latitude,
  longitude,
  showConstellations,
  showLabels,
  showArt = false,
  appMode,
  mediaElement,
  videoFormat = "fisheye",
  coveLight = true,
  coveColor = "#aa00ff",
  wallLight = true,
  onSlewingChange,
}: SkyDomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    dome: THREE.Mesh;
    stars: THREE.Points;
    domeMaterial: THREE.ShaderMaterial;
    lobbyMaterial: THREE.ShaderMaterial;
    starPositions: Float32Array;
    starGeometry: THREE.BufferGeometry;
    starMaterial: THREE.ShaderMaterial;
    constellationLine: THREE.LineSegments;
    constellationPositions: Float32Array;
    labelSprites: THREE.Sprite[];
    sunSprite: THREE.Mesh;
    roomLights: THREE.PointLight[];
    wallLights: THREE.Light[];
    ambient: THREE.AmbientLight;
    hemi: THREE.HemisphereLight;
    animationId: number;
    clock: THREE.Clock;

    targetCoveIntensity: number;
    currentCoveIntensity: number;
    targetWallLightIntensity: number;
    currentWallLightIntensity: number;
    fadeSphere: THREE.Mesh;
    transitionState: "idle" | "fading_out" | "fading_in";
    pendingMaterial: THREE.Material;
    pendingMode: "lobby" | "sky" | "movie";
    activeMode: "lobby" | "sky" | "movie";

    videoCanvas: HTMLCanvasElement;
    videoCtx: CanvasRenderingContext2D;
    targetVideoColor: THREE.Color;
    currentVideoColor: THREE.Color;
    frameCount: number;

    camYaw: number;
    camPitch: number;
    targetYaw: number;
    targetPitch: number;
    targetFov: number;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
    gimbalGroup: THREE.Group;
    polarAxisGroup: THREE.Group;
    currentDiurnal: number;
    isSlewing: boolean;
    lensMeshes: THREE.Mesh[];
  } | null>(null);

  const onSlewingChangeRef = useRef(onSlewingChange);
  onSlewingChangeRef.current = onSlewingChange;

  const simulationDateRef = useRef(simulationDate);
  const latRef = useRef(latitude);
  const lonRef = useRef(longitude);
  const showConstellationsRef = useRef(showConstellations);
  const showLabelsRef = useRef(showLabels);
  const wallLightRef = useRef(wallLight);
  const prevModeRef = useRef(appMode);
  const mediaElementRef = useRef(mediaElement);

  simulationDateRef.current = simulationDate;
  latRef.current = latitude;
  lonRef.current = longitude;
  showConstellationsRef.current = showConstellations;
  showLabelsRef.current = showLabels;
  wallLightRef.current = wallLight;
  mediaElementRef.current = mediaElement;

  const createGlowTexture = useCallback((color: string, size: number = 128) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.12, color);
    gradient.addColorStop(0.35, color.replace("1)", "0.35)"));
    gradient.addColorStop(0.65, color.replace("1)", "0.08)"));
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const createSolidCircleTexture = useCallback(
    (color: string, size: number = 64) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    },
    [],
  );

  const createTextSprite = useCallback(
    (text: string, color: string = "#4fc3f7", fontSize: number = 36) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 6;
      ctx.fillText(text, 64, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(14, 7, 1);
      return sprite;
    },
    [],
  );

  const buildInterior = useCallback((scene: THREE.Scene) => {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x22222a,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.BackSide,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x22222a,
      roughness: 0.8,
      metalness: 0.1,
    });
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0x88522c, // Darker brown
      roughness: 0.9,
      metalness: 0.2,
    });
    const seatCushionMaterial = new THREE.MeshStandardMaterial({
      color: 0xad6536, // Slightly darker orange-brown / Saddle leather
      roughness: 0.6,
      metalness: 0.1,
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x333344,
      roughness: 0.4,
      metalness: 0.6,
    });
    const fenceMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.1,
      metalness: 0.9,
    });
    const projectorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a25,
      roughness: 0.2,
      metalness: 0.8,
    });

    const wallGeo = new THREE.CylinderGeometry(
      ROOM_RADIUS,
      ROOM_RADIUS,
      WALL_HEIGHT,
      64,
      1,
      true,
    );
    const walls = new THREE.Mesh(wallGeo, wallMaterial);
    walls.position.y = FLOOR_Y + WALL_HEIGHT / 2;
    scene.add(walls);

    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
      metalness: 0.1,
    });
    const rimGeo = new THREE.TorusGeometry(ROOM_RADIUS - 0.5, 1.5, 8, 64);
    const rim = new THREE.Mesh(rimGeo, rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0;
    scene.add(rim);

    const floorGeo = new THREE.CircleGeometry(ROOM_RADIUS - 1, 64);
    const floor = new THREE.Mesh(floorGeo, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    scene.add(floor);

    for (let a = 0; a < 4; a++) {
      const angle = (a * Math.PI) / 2;
      const aisleGeo = new THREE.PlaneGeometry(3.5, ROOM_RADIUS * 1.8);
      const aisleMat = new THREE.MeshStandardMaterial({
        color: 0x15151a,
        roughness: 1.0,
      });
      const aisle = new THREE.Mesh(aisleGeo, aisleMat);
      aisle.rotation.x = -Math.PI / 2;
      aisle.rotation.z = angle;
      aisle.position.y = FLOOR_Y + 0.05;
      scene.add(aisle);
    }

    const maxSeats = 500;

    const backGeo = new THREE.BoxGeometry(2.4, 3.2, 0.4);
    backGeo.rotateX(-0.35);
    backGeo.translate(0, 2.6, -1.0);
    const imBack = new THREE.InstancedMesh(
      backGeo,
      seatCushionMaterial,
      maxSeats,
    );

    const headrestGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 16);
    headrestGeo.rotateZ(Math.PI / 2);
    headrestGeo.translate(0, 4.3, -1.6);
    const imHeadrest = new THREE.InstancedMesh(
      headrestGeo,
      seatCushionMaterial,
      maxSeats,
    );

    const cushionGeo = new THREE.BoxGeometry(2.4, 0.5, 2.2);
    cushionGeo.rotateX(0.1);
    cushionGeo.translate(0, 1.3, 0.0);
    const imCushion = new THREE.InstancedMesh(
      cushionGeo,
      seatCushionMaterial,
      maxSeats,
    );

    const kneeGeo = new THREE.CylinderGeometry(0.25, 0.25, 2.4, 16);
    kneeGeo.rotateZ(Math.PI / 2);
    kneeGeo.translate(0, 1.28, 1.1);
    const imKnee = new THREE.InstancedMesh(
      kneeGeo,
      seatCushionMaterial,
      maxSeats,
    );

    const pillarGeo = new THREE.CylinderGeometry(0.6, 0.8, 1.3, 16);
    pillarGeo.translate(0, 0.65, -0.2);
    const imPillar = new THREE.InstancedMesh(pillarGeo, seatMaterial, maxSeats);

    const armGeoL = new THREE.BoxGeometry(0.4, 0.2, 2.5);
    armGeoL.rotateX(0.05);
    armGeoL.translate(-1.45, 1.9, 0.2);
    const imArmL = new THREE.InstancedMesh(armGeoL, seatMaterial, maxSeats);

    const armGeoR = new THREE.BoxGeometry(0.4, 0.2, 2.5);
    armGeoR.rotateX(0.05);
    armGeoR.translate(1.45, 1.9, 0.2);
    const imArmR = new THREE.InstancedMesh(armGeoR, seatMaterial, maxSeats);

    const supportGeoL = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
    supportGeoL.translate(-1.45, 1.4, 0.5);
    const imSupportL = new THREE.InstancedMesh(
      supportGeoL,
      metalMaterial,
      maxSeats,
    );

    const supportGeoR = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
    supportGeoR.translate(1.45, 1.4, 0.5);
    const imSupportR = new THREE.InstancedMesh(
      supportGeoR,
      metalMaterial,
      maxSeats,
    );

    const panelGeoL = new THREE.BoxGeometry(0.15, 2.2, 2.0);
    panelGeoL.rotateX(-0.2);
    panelGeoL.translate(-1.6, 1.6, -0.4);
    const imPanelL = new THREE.InstancedMesh(panelGeoL, seatMaterial, maxSeats);

    const panelGeoR = new THREE.BoxGeometry(0.15, 2.2, 2.0);
    panelGeoR.rotateX(-0.2);
    panelGeoR.translate(1.6, 1.6, -0.4);
    const imPanelR = new THREE.InstancedMesh(panelGeoR, seatMaterial, maxSeats);

    let seatIndex = 0;
    const seatDummy = new THREE.Object3D();

    for (let row = 0; row < SEAT_ROWS; row++) {
      const rowRadius = 20 + row * 7;
      const seatCount = Math.floor(16 + row * 10);
      const rowY = FLOOR_Y + 0.5;
      const angleStep = (Math.PI * 2) / seatCount;

      for (let s = 0; s < seatCount; s++) {
        const angle = s * angleStep;

        const aisleAngle = angle % (Math.PI / 2);
        if (aisleAngle < 0.15 || aisleAngle > Math.PI / 2 - 0.15) continue;

        seatDummy.position.set(
          Math.cos(angle) * rowRadius,
          rowY,
          Math.sin(angle) * rowRadius,
        );
        seatDummy.lookAt(0, rowY, 0);
        seatDummy.updateMatrix();

        imBack.setMatrixAt(seatIndex, seatDummy.matrix);
        imHeadrest.setMatrixAt(seatIndex, seatDummy.matrix);
        imCushion.setMatrixAt(seatIndex, seatDummy.matrix);
        imKnee.setMatrixAt(seatIndex, seatDummy.matrix);
        imPillar.setMatrixAt(seatIndex, seatDummy.matrix);
        imArmL.setMatrixAt(seatIndex, seatDummy.matrix);
        imArmR.setMatrixAt(seatIndex, seatDummy.matrix);
        imSupportL.setMatrixAt(seatIndex, seatDummy.matrix);
        imSupportR.setMatrixAt(seatIndex, seatDummy.matrix);
        imPanelL.setMatrixAt(seatIndex, seatDummy.matrix);
        imPanelR.setMatrixAt(seatIndex, seatDummy.matrix);
        seatIndex++;
      }
    }

    imBack.count = seatIndex;
    imHeadrest.count = seatIndex;
    imCushion.count = seatIndex;
    imKnee.count = seatIndex;
    imPillar.count = seatIndex;
    imArmL.count = seatIndex;
    imArmR.count = seatIndex;
    imSupportL.count = seatIndex;
    imSupportR.count = seatIndex;
    imPanelL.count = seatIndex;
    imPanelR.count = seatIndex;

    scene.add(
      imBack,
      imHeadrest,
      imCushion,
      imKnee,
      imPillar,
      imArmL,
      imArmR,
      imSupportL,
      imSupportR,
      imPanelL,
      imPanelR,
    );

    const platformGeo = new THREE.CylinderGeometry(15, 15, 1.5, 64);
    const platform = new THREE.Mesh(platformGeo, metalMaterial);
    platform.position.y = FLOOR_Y + 0.75;
    scene.add(platform);

    const fenceRadius = 14;

    const railGeo = new THREE.TorusGeometry(fenceRadius, 0.15, 8, 64);
    const rail = new THREE.Mesh(railGeo, fenceMetalMaterial);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = FLOOR_Y + 4.0;
    scene.add(rail);

    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8);
      const post = new THREE.Mesh(postGeo, fenceMetalMaterial);
      post.position.set(
        Math.cos(a) * fenceRadius,
        FLOOR_Y + 2.75,
        Math.sin(a) * fenceRadius,
      );
      scene.add(post);
    }

    const projectorGroup = new THREE.Group();
    projectorGroup.position.set(0, FLOOR_Y + 0.5, 0);

    const projBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7,
      metalness: 0.2,
    });
    const projFrameMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.4,
      metalness: 0.3,
    });
    const projDetailMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
      metalness: 0.4,
    });
    const projLensMat = new THREE.MeshStandardMaterial({
      color: 0x020202,
      roughness: 0.05,
      metalness: 0.8,
    });

    const standGroup = new THREE.Group();
    const legLength = 22; // Reach to y=20.25 from floor

    for (const side of [-1, 1]) {
      const sideGroup = new THREE.Group();
      sideGroup.position.set(side * 6.0, 20.25, 0); // Top joint position

      // Front leg
      const frontLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, legLength, 16),
        projFrameMat,
      );
      frontLeg.position.set(side * 1.5, -10.125, 3.5);
      frontLeg.rotation.x = -0.3; // flare out in Z
      frontLeg.rotation.z = side * 0.15; // flare out in X
      sideGroup.add(frontLeg);

      // Back leg
      const backLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.9, legLength, 16),
        projFrameMat,
      );
      backLeg.position.set(side * 1.5, -10.125, -3.5);
      backLeg.rotation.x = 0.3;
      backLeg.rotation.z = side * 0.15;
      sideGroup.add(backLeg);

      // Top joint enclosure
      const joint = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 2.5, 32),
        projBaseMat,
      );
      joint.rotation.x = Math.PI / 2;
      sideGroup.add(joint);

      // Lamps on the stand
      const lampGroup = new THREE.Group();
      lampGroup.position.set(0, 3.0, 0); // Position above the joint

      // Base / Stem connecting to the joint
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 1.2, 1.5, 16),
        projDetailMat,
      );
      stem.position.y = -0.75;
      lampGroup.add(stem);

      // Shade (Flat dish pointing straight UP)
      const shadeGroup = new THREE.Group();
      shadeGroup.position.set(0, 0, 0);

      // Cone pointing UP (open end at +Y)
      const coneGeo = new THREE.ConeGeometry(2.5, 0.8, 32, 1, true);
      coneGeo.rotateX(Math.PI);

      const shade = new THREE.Mesh(
        coneGeo,
        new THREE.MeshStandardMaterial({
          color: 0x151515,
          roughness: 0.7,
          metalness: 0.3,
          side: THREE.DoubleSide,
        }),
      );
      shade.position.y = 0.4; // Tip at 0, open end at 0.8
      shadeGroup.add(shade);

      const shadeCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.4, 0.5, 16),
        projFrameMat,
      );
      shadeCap.position.y = -0.25;
      shadeGroup.add(shadeCap);

      // Use a cylindrical lamp instead of a dome
      const lampGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 16); // Slightly shorter cylinder
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffeedd,
        emissive: 0xffaa55,
        emissiveIntensity: 0.6, // Dimmer as requested
        roughness: 0.2,
      });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      // Positioned to sit perfectly inside the cone without poking through
      lamp.position.y = 1.2; // Adjusted for the shorter height (bottom stays at 0.3)
      shadeGroup.add(lamp);

      const lampLight = new THREE.PointLight(0xffaa55, 0.4, 30);
      lampLight.position.y = 2.1;
      shadeGroup.add(lampLight);

      lampGroup.add(shadeGroup);

      sideGroup.add(lampGroup);
      standGroup.add(sideGroup);
    }
    projectorGroup.add(standGroup);
    projectorGroup.rotation.y = Math.PI / 2; // Orient stand East-West

    // 3. Gimbal axis (The main tiltable structure for latitude)
    const gimbal = new THREE.Group();
    gimbal.position.set(0, 20.25, 0); // Aligns with the fork joints
    gimbal.rotation.x = Math.PI / 2;

    // Cross-axis connecting to forks
    const crossAxis = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 12.5, 32),
      projDetailMat,
    );
    crossAxis.rotation.z = Math.PI / 2;
    gimbal.add(crossAxis);

    const polarAxis = new THREE.Group();
    gimbal.add(polarAxis);

    // Central core (large gear/ring section)
    const coreCenter = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 4.8, 4.5, 32),
      projBaseMat,
    );
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.9, 0.4, 16, 64),
      projDetailMat,
    );
    polarAxis.add(coreCenter);
    polarAxis.add(coreRing);

    // Planetary projectors ring (The wide halo ring)
    const planetRingGeo = new THREE.TorusGeometry(6.5, 0.2, 8, 64);
    const planetRing = new THREE.Mesh(planetRingGeo, projFrameMat);
    planetRing.rotation.x = Math.PI / 2;
    polarAxis.add(planetRing);

    for (let i = 0; i < 8; i++) {
      const pBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.8, 1.2),
        projDetailMat,
      );
      const a = (i * Math.PI) / 4;
      pBox.position.set(Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5);
      pBox.lookAt(0, 0, 0);
      polarAxis.add(pBox);
    }

    // 4. North & South sections
    const sphereGeo = new THREE.IcosahedronGeometry(4.8, 4);
    const lensPlacer = new THREE.IcosahedronGeometry(4.8, 2);
    const posAttr = lensPlacer.getAttribute("position");

    for (const side of [-1, 1]) {
      const sideGroup = new THREE.Group();

      // The Truss Lattice Neck
      const latticeGeo = new THREE.CylinderGeometry(3.0, 3.0, 5.5, 16, 4, true);
      const latticeMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        wireframe: true,
      });
      const lattice = new THREE.Mesh(latticeGeo, latticeMat);
      lattice.position.y = side * 5.0;
      sideGroup.add(lattice);

      // Solid core inside lattice
      const innerCore = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 5.5, 16),
        projDetailMat,
      );
      innerCore.position.y = side * 5.0;
      sideGroup.add(innerCore);

      // Flange between lattice and sphere
      const flange = new THREE.Mesh(
        new THREE.CylinderGeometry(4.6, 4.6, 0.6, 32),
        projFrameMat,
      );
      flange.position.y = side * 8.0;
      sideGroup.add(flange);

      // The Main Sphere
      const sphereGroup = new THREE.Group();
      sphereGroup.position.y = side * 12.5;
      const sphereMesh = new THREE.Mesh(sphereGeo, projBaseMat);
      sphereGroup.add(sphereMesh);

      const maxLenses = 500;
      const imRingGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.7, 16);
      imRingGeo.rotateX(Math.PI / 2);
      const imRing = new THREE.InstancedMesh(
        imRingGeo,
        projDetailMat,
        maxLenses,
      );

      const imBarrelGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.0, 16);
      imBarrelGeo.rotateX(Math.PI / 2);
      imBarrelGeo.translate(0, 0, 0.2);
      const imBarrel = new THREE.InstancedMesh(
        imBarrelGeo,
        projFrameMat,
        maxLenses,
      );

      const imGlassGeo = new THREE.SphereGeometry(
        0.55,
        16,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      imGlassGeo.rotateX(Math.PI / 2);
      imGlassGeo.translate(0, 0, 0.6);
      const imGlass = new THREE.InstancedMesh(
        imGlassGeo,
        projLensMat,
        maxLenses,
      );

      let lensCount = 0;
      const dummy = new THREE.Object3D();

      for (let v = 0; v < posAttr.count; v += 3) {
        const vx = posAttr.getX(v),
          vy = posAttr.getY(v),
          vz = posAttr.getZ(v);
        // Skip inward facing lenses
        if (side === 1 && vy < -1.8) continue;
        if (side === -1 && vy > 1.8) continue;

        dummy.position.set(vx, vy, vz);
        dummy.lookAt(vx * 2, vy * 2, vz * 2);
        dummy.updateMatrix();

        imRing.setMatrixAt(lensCount, dummy.matrix);
        imBarrel.setMatrixAt(lensCount, dummy.matrix);
        imGlass.setMatrixAt(lensCount, dummy.matrix);
        lensCount++;
      }

      imRing.count = lensCount;
      imBarrel.count = lensCount;
      imGlass.count = lensCount;

      sphereGroup.add(imRing, imBarrel, imGlass);

      // Mini-spheres (satellite projectors)
      const topMini = new THREE.Group();
      topMini.position.y = side === 1 ? 5.5 : -5.5;
      if (side === -1) topMini.rotation.x = Math.PI;

      const miniStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8),
        projFrameMat,
      );
      const miniBall = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.5, 2),
        projBaseMat,
      );
      miniBall.position.y = 1.2;
      topMini.add(miniStem);
      topMini.add(miniBall);

      // Lenses for mini ball
      const miniLensGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8);
      for (let mx of [-1, 0, 1]) {
        for (let mz of [-1, 1]) {
          if (mx === 0 && mz === 0) continue;
          const mLens = new THREE.Mesh(miniLensGeo, projDetailMat);
          mLens.position.set(mx * 1.3, 1.2, mz * 1.3);
          mLens.lookAt(mx * 3, 1.2, mz * 3);
          mLens.rotation.x = Math.PI / 2;
          topMini.add(mLens);
        }
      }
      sphereGroup.add(topMini);

      sideGroup.add(sphereGroup);
      polarAxis.add(sideGroup);
    }

    projectorGroup.add(gimbal);
    projectorGroup.scale.set(0.9, 0.9, 0.9); // Scale up to be massive and tall
    scene.add(projectorGroup);

    // Digital Projectors (for Fulldome Movie projection)
    const lensMeshes: THREE.Mesh[] = [];
    const digiProjPositions = [
      { x: 0, z: -11.0 }, // Moved inwards from -13.5
      { x: 0, z: 11.0 }, // Moved inwards from 13.5
    ];

    digiProjPositions.forEach((pos) => {
      const digiGroup = new THREE.Group();
      // Position the base rack on the raised platform inside the pit
      digiGroup.position.set(pos.x, FLOOR_Y + 1.5, pos.z);
      digiGroup.lookAt(0, FLOOR_Y + 1.5, 0); // Rack faces center

      // Base frame (A sturdy industrial bracket)
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.9,
        roughness: 0.3,
      });
      // Thick base plate
      const baseBlock = new THREE.Mesh(
        new THREE.BoxGeometry(6.4, 0.4, 4.0),
        frameMat,
      );
      baseBlock.position.set(0, 0.2, 0); // Sitting on FLOOR_Y + 1.5
      digiGroup.add(baseBlock);

      // Thick side pillars
      const pillarL = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 3.5, 1.2),
        frameMat,
      );
      pillarL.position.set(-2.8, 1.95, 0);
      const pillarR = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 3.5, 1.2),
        frameMat,
      );
      pillarR.position.set(2.8, 1.95, 0);
      digiGroup.add(pillarL, pillarR);

      // Aiming group (to aim the projector)
      const aimGroup = new THREE.Group();
      aimGroup.position.set(pos.x, FLOOR_Y + 4.0, pos.z);
      // Look AWAY from the center, towards the dome behind it
      aimGroup.lookAt(pos.x * 3.0, DOME_RADIUS * 0.9, pos.z * 3.0);

      // Pivot Axle
      const axleGeo = new THREE.CylinderGeometry(0.3, 0.3, 6.4, 16);
      const axleMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.8,
      });
      const axle = new THREE.Mesh(axleGeo, axleMat);
      axle.rotation.z = Math.PI / 2;
      aimGroup.add(axle);

      // Projector body
      const bodyGroup = new THREE.Group();

      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.7,
      });
      // Main block
      const bodyGeo = new THREE.BoxGeometry(4.2, 2.2, 6.0);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.z = -1.5;
      bodyGroup.add(body);

      // Back fan/exhaust block
      const backGeo = new THREE.BoxGeometry(3.6, 1.8, 1.5);
      const backBlock = new THREE.Mesh(backGeo, bodyMat);
      backBlock.position.z = -5.25;
      bodyGroup.add(backBlock);

      // Lens Tube
      const lensTubeGeo = new THREE.CylinderGeometry(0.6, 0.65, 2.5, 32);
      const lensMat = new THREE.MeshStandardMaterial({
        color: 0x050505,
        roughness: 0.2,
        metalness: 0.8,
      });
      const lensTube = new THREE.Mesh(lensTubeGeo, lensMat);
      lensTube.rotation.x = Math.PI / 2;
      lensTube.position.z = 2.0;
      lensTube.position.y = 0.4;
      bodyGroup.add(lensTube);

      // Fisheye Dome on the lens
      const glassGeo = new THREE.SphereGeometry(
        0.8,
        32,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.05,
        metalness: 0.9,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.rotation.x = Math.PI / 2;
      glass.position.z = 3.3;
      glass.position.y = 0.4;
      bodyGroup.add(glass);
      lensMeshes.push(glass);

      // Lens Hood (Half-cylinder scoop acting as a visor under the bottom half of the lens)
      // thetaStart = -Math.PI / 2, thetaLength = Math.PI covers the bottom half
      const hoodGeo = new THREE.CylinderGeometry(
        0.85,
        0.85,
        1.0,
        32,
        1,
        true,
        -Math.PI / 2,
        Math.PI,
      );
      const hoodMat = new THREE.MeshStandardMaterial({
        color: 0x050505,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      const hood = new THREE.Mesh(hoodGeo, hoodMat);
      hood.rotation.x = Math.PI / 2;
      hood.position.z = 3.6; // Extends out past the glass
      hood.position.y = 0.4; // Centered on the lens
      bodyGroup.add(hood);

      aimGroup.add(bodyGroup);
      scene.add(digiGroup);
      scene.add(aimGroup);
    });

    const roomLights: THREE.PointLight[] = [];
    const wallLights: THREE.Light[] = [];

    const SCONCE_COUNT = 16;
    const sconceMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7,
      metalness: 0.5,
    });

    for (let i = 0; i < SCONCE_COUNT; i++) {
      const angle = (i / SCONCE_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * (ROOM_RADIUS - 1.0);
      const z = Math.sin(angle) * (ROOM_RADIUS - 1.0);
      const y = FLOOR_Y + 16; // higher up the wall

      const sconceGroup = new THREE.Group();
      sconceGroup.position.set(x, y, z);
      sconceGroup.lookAt(0, y, 0);

      const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 3.0, 16),
        sconceMat,
      );
      fixture.position.z = 0.4;
      sconceGroup.add(fixture);
      scene.add(sconceGroup);

      // Only add a SpotLight for every 4th sconce to save performance (4 lights total instead of 16)
      if (i % 4 === 0) {
        // Down-firing spotlight, aiming slightly towards the wall base
        const spotLight = new THREE.SpotLight(
          0xffebd6,
          160.0, // Compensate for fewer lights
          100,
          Math.PI / 2.0, // Wider angle
          0.8,
          1.0,
        );
        spotLight.position.set(x * 0.95, y - 1.0, z * 0.95);

        const target = new THREE.Object3D();
        target.position.set(x * 1.0, FLOOR_Y, z * 1.0);
        scene.add(target);
        spotLight.target = target;

        scene.add(spotLight);
        wallLights.push(spotLight);
      }
    }

    const ambient = new THREE.AmbientLight(0x2a3a5a, 2.0);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x5a7aaa, 0x1a2038, 1.5);
    scene.add(hemi);

    const domeLight = new THREE.PointLight(0x4466aa, 3.0, 300);
    domeLight.position.set(0, DOME_RADIUS * 0.6, 0);
    scene.add(domeLight);
    roomLights.push(domeLight);

    const centerFill = new THREE.PointLight(0x556688, 2.0, 150);
    centerFill.position.set(0, FLOOR_Y + PROJECTOR_HEIGHT + 10, 0);
    scene.add(centerFill);
    roomLights.push(centerFill);

    return {
      roomLights,
      wallLights,
      ambient,
      hemi,
      gimbal,
      polarAxis,
      lensMeshes,
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);

    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );

    const seatAngle = Math.PI * 1.25; // Sit between W and S (South-West quadrant)
    const seatRadius = 55;
    let camX = Math.cos(seatAngle) * seatRadius;
    let camY = FLOOR_Y + 5.5; // Lowered eye level to simulate sitting
    let camZ = Math.sin(seatAngle) * seatRadius;
    camera.position.set(camX, camY, camZ);

    const initYaw = Math.atan2(-camZ, -camX);
    const initPitch = 0.6;
    let camYaw = initYaw;
    let camPitch = initPitch;
    let targetYaw = initYaw;
    let targetPitch = initPitch;
    let targetFov = 75;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function updateCameraLook() {
      const lookDist = 100;
      const lookX = camX + Math.cos(camPitch) * Math.cos(camYaw) * lookDist;
      const lookY = camY + Math.sin(camPitch) * lookDist;
      const lookZ = camZ + Math.cos(camPitch) * Math.sin(camYaw) * lookDist;
      camera.lookAt(lookX, lookY, lookZ);
    }
    updateCameraLook();

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement) !== renderer.domElement) return;
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      const sensitivity = 0.003;
      targetYaw += dx * sensitivity;
      targetPitch -= dy * sensitivity;

      targetPitch = Math.max(-0.15, Math.min(Math.PI * 0.48, targetPitch));
    };
    const onMouseUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetFov += e.deltaY * 0.05;
      targetFov = Math.max(30, Math.min(100, targetFov));
    };

    let lastTouchX = 0;
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      const sensitivity = 0.004;
      targetYaw += dx * sensitivity;
      targetPitch -= dy * sensitivity;
      targetPitch = Math.max(-0.15, Math.min(Math.PI * 0.48, targetPitch));
    };
    const onTouchEnd = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchstart", onTouchStart, {
      passive: true,
    });
    renderer.domElement.addEventListener("touchmove", onTouchMove, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchend", onTouchEnd);

    const keys = { w: false, a: false, s: false, d: false };
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      )
        return;
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key as keyof typeof keys] = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key as keyof typeof keys] = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const domeGeo = new THREE.SphereGeometry(
      DOME_RADIUS,
      128,
      64,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const domeMaterial = new THREE.ShaderMaterial({
      vertexShader: DOME_VERTEX_SHADER,
      fragmentShader: DOME_FRAGMENT_SHADER,
      uniforms: {
        uZenithColor: { value: new THREE.Color() },
        uHorizonColor: { value: new THREE.Color() },
        uSunDirection: { value: new THREE.Vector3() },
        uSunGlowColor: { value: new THREE.Color() },
        uBrightness: { value: 0 },
        uCoveColor: { value: new THREE.Color(coveColor) },
        uCoveIntensity: { value: coveLight ? 1.5 : 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: true,
    });

    const lobbyMaterial = new THREE.ShaderMaterial({
      vertexShader: DOME_VERTEX_SHADER,
      fragmentShader: LOBBY_FRAGMENT_SHADER,
      uniforms: {
        uCoveColor: { value: new THREE.Color(coveColor) },
        uCoveIntensity: { value: coveLight ? 1.5 : 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: true,
    });

    const dome = new THREE.Mesh(domeGeo, domeMaterial);
    dome.position.y = 0;
    scene.add(dome);

    const {
      roomLights,
      wallLights,
      ambient,
      hemi,
      gimbal,
      polarAxis,
      lensMeshes,
    } = buildInterior(scene);

    const starCount = STARS.length;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starColors = new Float32Array(starCount * 3);
    const starTwinkle = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const star = STARS[i];

      const size = Math.max(0.2, 2.5 - star.mag * 0.4);
      starSizes[i] = size;

      let [r, g, b] = bvToRGB(star.bv);

      const avg = (r + g + b) / 3.0;
      starColors[i * 3] = r * 0.15 + avg * 0.85;
      starColors[i * 3 + 1] = g * 0.15 + avg * 0.85;
      starColors[i * 3 + 2] = b * 0.15 + avg * 0.85;

      starTwinkle[i] = Math.random();
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
    starGeometry.setAttribute(
      "aColor",
      new THREE.BufferAttribute(starColors, 3),
    );
    starGeometry.setAttribute(
      "aTwinkle",
      new THREE.BufferAttribute(starTwinkle, 1),
    );

    const starMaterial = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uBrightness: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const nameIndex = buildStarNameIndex();
    let lineVertexCount = 0;
    for (const c of CONSTELLATIONS) {
      for (const [s1, s2] of c.lines) {
        if (s1 !== s2 && nameIndex.has(s1) && nameIndex.has(s2)) {
          lineVertexCount += 2;
        }
      }
    }

    const constellationPositions = new Float32Array(lineVertexCount * 3);
    const constellationGeo = new THREE.BufferGeometry();
    constellationGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(constellationPositions, 3),
    );
    constellationGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(constellationPositions, 3),
    );
    const constellationMat = new THREE.LineBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const constellationLine = new THREE.LineSegments(
      constellationGeo,
      constellationMat,
    );
    scene.add(constellationLine);

    const sunTex = createSolidCircleTexture("rgba(255, 250, 240, 1)");
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sunSprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sunMat);
    sunSprite.scale.set(2, 2, 1);
    scene.add(sunSprite);

    const dirs = [
      { label: "N", az: 0 },
      { label: "E", az: 90 },
      { label: "S", az: 180 },
      { label: "W", az: 270 },
    ];
    const labelSprites: THREE.Sprite[] = [];
    for (const dir of dirs) {
      const sprite = createTextSprite(dir.label, "#4fc3f7", 40);
      const azRad = (dir.az * Math.PI) / 180;
      sprite.position.set(
        Math.cos(azRad) * (DOME_RADIUS - 5),
        3,
        Math.sin(azRad) * (DOME_RADIUS - 5),
      );
      sprite.scale.set(10, 5, 1);
      scene.add(sprite);
      labelSprites.push(sprite);
    }

    const clock = new THREE.Clock();

    const fadeGeo = new THREE.SphereGeometry(
      DOME_RADIUS - 0.5,
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const fadeMat = new THREE.ShaderMaterial({
      vertexShader: FADE_VERTEX_SHADER,
      fragmentShader: FADE_FRAGMENT_SHADER,
      uniforms: {
        uOpacity: { value: 0.0 },
        uCoveColor: { value: new THREE.Color(coveColor) },
        uCoveIntensity: { value: coveLight ? 1.5 : 0.0 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const fadeSphere = new THREE.Mesh(fadeGeo, fadeMat);
    fadeSphere.position.y = 0;
    fadeSphere.renderOrder = 999; // Ensure it covers everything
    scene.add(fadeSphere);

    const videoCanvas = document.createElement("canvas");
    videoCanvas.width = 16;
    videoCanvas.height = 16;
    const videoCtx = videoCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;

    const initialJd = dateToJD(simulationDate);
    const initialLocalST = lst(initialJd, longitude);
    const initialDiurnal =
      appMode === "sky" ? -(initialLocalST / 24.0) * Math.PI * 2 : 0;

    sceneRef.current = {
      renderer,
      scene,
      camera,
      dome,
      stars,
      domeMaterial,
      lobbyMaterial,
      starPositions,
      starGeometry,
      starMaterial,
      constellationLine,
      constellationPositions,
      labelSprites,
      sunSprite,
      roomLights,
      wallLights,
      ambient,
      hemi,
      animationId: 0,
      clock,
      targetCoveIntensity: coveLight ? 1.5 : 0.0,
      currentCoveIntensity: coveLight ? 1.5 : 0.0,
      targetWallLightIntensity: wallLight ? 1.0 : 0.0,
      currentWallLightIntensity: wallLight ? 1.0 : 0.0,
      fadeSphere,
      transitionState: "idle",
      pendingMaterial: domeMaterial,
      pendingMode: appMode,
      activeMode: appMode,
      videoCanvas,
      videoCtx,
      targetVideoColor: new THREE.Color(0x334455),
      currentVideoColor: new THREE.Color(0x334455),
      frameCount: 0,
      camYaw,
      camPitch,
      targetYaw,
      targetPitch,
      targetFov,
      isDragging,
      lastMouseX,
      lastMouseY,
      gimbalGroup: gimbal,
      polarAxisGroup: polarAxis,
      currentDiurnal: initialDiurnal,
      isSlewing: false,
      lensMeshes,
    };

    gimbal.rotation.x = Math.PI / 2 + initialDiurnal;
    polarAxis.rotation.y = initialDiurnal * 2.0;

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    function raDecToDome(
      raHours: number,
      decDeg: number,
      lat: number,
      localST: number,
      radius: number = DOME_RADIUS - 2,
    ): [number, number, number] {
      const { altitude, azimuth } = raDecToAltAz(raHours, decDeg, lat, localST);

      const alt = altitude * (Math.PI / 180);
      const az = azimuth * (Math.PI / 180);

      const x = Math.cos(alt) * Math.cos(az) * radius;
      const y = Math.sin(alt) * radius;
      const z = Math.cos(alt) * Math.sin(az) * radius;

      return [x, y, z];
    }

    const animate = () => {
      const s = sceneRef.current;
      if (!s) return;
      s.animationId = requestAnimationFrame(animate);

      const date = simulationDateRef.current;
      const lat = latRef.current;
      const lon = lonRef.current;
      const jd = dateToJD(date);
      const localST = lst(jd, lon);
      const dt = Math.min(0.1, s.clock.getDelta());
      const elapsed = s.clock.elapsedTime;
      const showConst = showConstellationsRef.current;
      const isSky = s.activeMode === "sky";

      s.constellationLine.visible = showConst && isSky;
      s.labelSprites.forEach((sprite) => {
        sprite.visible = showLabelsRef.current && isSky;
      });

      // Cove Intensity Smooth Fade
      if (Math.abs(s.currentCoveIntensity - s.targetCoveIntensity) > 0.005) {
        s.currentCoveIntensity +=
          (s.targetCoveIntensity - s.currentCoveIntensity) *
          Math.min(1.0, dt * 2.0);
      }

      // Wall Lights
      s.targetWallLightIntensity =
        s.activeMode === "sky" ? 0.0 : wallLightRef.current ? 1.0 : 0.0;

      if (
        Math.abs(s.currentWallLightIntensity - s.targetWallLightIntensity) >
        0.005
      ) {
        s.currentWallLightIntensity +=
          (s.targetWallLightIntensity - s.currentWallLightIntensity) *
          Math.min(1.0, dt * 3.0);
      }
      const wallIntensity = s.currentWallLightIntensity;

      s.wallLights.forEach((wl) => {
        wl.intensity = wallIntensity * 160.0;
      });

      // Calculate exact diurnal angle
      let targetDiurnal = 0;

      if (isSky) {
        // Track sky based on time
        targetDiurnal = -(localST / 24.0) * Math.PI * 2;
      } else {
        // Find the nearest horizontal park position (any multiple of PI)
        targetDiurnal = Math.round(s.currentDiurnal / Math.PI) * Math.PI;
      }

      // Smooth unwrap for diurnal motion when tracking sky
      if (isSky) {
        while (targetDiurnal - s.currentDiurnal > Math.PI)
          targetDiurnal -= Math.PI * 2;
        while (targetDiurnal - s.currentDiurnal < -Math.PI)
          targetDiurnal += Math.PI * 2;
      }

      // Report slewing state only when parking
      const isCurrentlySlewing =
        !isSky && Math.abs(targetDiurnal - s.currentDiurnal) > 0.05;
      if (s.isSlewing !== isCurrentlySlewing) {
        s.isSlewing = isCurrentlySlewing;
        if (onSlewingChangeRef.current) {
          onSlewingChangeRef.current(isCurrentlySlewing);
        }
      }

      if (isSky) {
        // Snap directly to the exact position to track the sky in real-time
        s.currentDiurnal = targetDiurnal;
      } else {
        // Apply slow, smooth mechanical speed limit when parking
        const maxMechSpeed = 0.05; // radians per second (very slow and heavy)
        let step = (targetDiurnal - s.currentDiurnal) * dt * 0.2;
        if (Math.abs(step) > maxMechSpeed * dt) {
          step = Math.sign(step) * maxMechSpeed * dt;
        }
        s.currentDiurnal += step;
      }

      // Horizontal is Math.PI/2, plus tumbling tilt
      const targetGimbalRot = Math.PI / 2 + s.currentDiurnal;
      s.gimbalGroup.rotation.x = targetGimbalRot;

      // We can also spin the polar axis slightly for extra mechanical effect
      s.polarAxisGroup.rotation.y = s.currentDiurnal * 2.0;

      const currentMat = s.dome.material as any;
      if (currentMat.uniforms && currentMat.uniforms.uCoveIntensity) {
        currentMat.uniforms.uCoveIntensity.value = s.currentCoveIntensity;
      }

      const fadeMat = s.fadeSphere.material as THREE.ShaderMaterial;
      if (fadeMat.uniforms && fadeMat.uniforms.uCoveIntensity) {
        fadeMat.uniforms.uCoveIntensity.value = s.currentCoveIntensity;
      }

      // Mode Transition Fading
      if (s.transitionState === "fading_out") {
        const mat = s.fadeSphere.material as THREE.ShaderMaterial;
        mat.uniforms.uOpacity.value += 2.0 * dt; // 0.5s fade to black
        if (mat.uniforms.uOpacity.value >= 1.0) {
          mat.uniforms.uOpacity.value = 1.0;
          s.transitionState = "fading_in";

          s.dome.material = s.pendingMaterial;
          s.activeMode = s.pendingMode;
          // Apply instant visibilities
          const isSkyModeNow = s.activeMode === "sky";
          s.stars.visible = isSkyModeNow;
          s.sunSprite.visible = isSkyModeNow;
          s.constellationLine.visible =
            showConstellationsRef.current && isSkyModeNow;
        }
      } else if (s.transitionState === "fading_in") {
        const mat = s.fadeSphere.material as THREE.ShaderMaterial;
        mat.uniforms.uOpacity.value -= 2.0 * dt; // 0.5s fade from black
        if (mat.uniforms.uOpacity.value <= 0.0) {
          mat.uniforms.uOpacity.value = 0.0;
          s.transitionState = "idle";
        }
      }

      for (let i = 0; i < STARS.length; i++) {
        const star = STARS[i];
        const altAz = raDecToAltAz(star.ra, star.dec, lat, localST);

        if (altAz.altitude > 0) {
          const [x, y, z] = raDecToDome(star.ra, star.dec, lat, localST);
          s.starPositions[i * 3] = x;
          s.starPositions[i * 3 + 1] = y;
          s.starPositions[i * 3 + 2] = z;
        } else {
          s.starPositions[i * 3] = 0;
          s.starPositions[i * 3 + 1] = -999;
          s.starPositions[i * 3 + 2] = 0;
        }
      }
      s.starGeometry.attributes.position.needsUpdate = true;

      const currentMode = s.activeMode;
      const isSkyMode = currentMode === "sky";

      if (showConst && isSkyMode) {
        let vi = 0;
        for (const c of CONSTELLATIONS) {
          for (const [s1Name, s2Name] of c.lines) {
            if (s1Name === s2Name) continue;
            const i1 = nameIndex.get(s1Name);
            const i2 = nameIndex.get(s2Name);
            if (i1 === undefined || i2 === undefined) continue;

            const alt1 = raDecToAltAz(
              STARS[i1].ra,
              STARS[i1].dec,
              lat,
              localST,
            ).altitude;
            const alt2 = raDecToAltAz(
              STARS[i2].ra,
              STARS[i2].dec,
              lat,
              localST,
            ).altitude;

            if (alt1 > 0 && alt2 > 0) {
              const [x1, y1, z1] = raDecToDome(
                STARS[i1].ra,
                STARS[i1].dec,
                lat,
                localST,
              );
              const [x2, y2, z2] = raDecToDome(
                STARS[i2].ra,
                STARS[i2].dec,
                lat,
                localST,
              );
              s.constellationPositions[vi * 3] = x1;
              s.constellationPositions[vi * 3 + 1] = y1;
              s.constellationPositions[vi * 3 + 2] = z1;
              vi++;
              s.constellationPositions[vi * 3] = x2;
              s.constellationPositions[vi * 3 + 1] = y2;
              s.constellationPositions[vi * 3 + 2] = z2;
              vi++;
            } else {
              s.constellationPositions[vi * 3] = 0;
              s.constellationPositions[vi * 3 + 1] = -999;
              s.constellationPositions[vi * 3 + 2] = 0;
              vi++;
              s.constellationPositions[vi * 3] = 0;
              s.constellationPositions[vi * 3 + 1] = -999;
              s.constellationPositions[vi * 3 + 2] = 0;
              vi++;
            }
          }
        }
        s.constellationLine.geometry.attributes.position.needsUpdate = true;
      }

      const sunPos = sunPosition(jd);
      const sunAltAz = raDecToAltAz(sunPos.ra, sunPos.dec, lat, localST);
      if (sunAltAz.altitude > 0 && isSkyMode) {
        const [sx, sy, sz] = raDecToDome(
          sunPos.ra,
          sunPos.dec,
          lat,
          localST,
          DOME_RADIUS - 4,
        );
        s.sunSprite.position.set(sx, sy, sz);
        s.sunSprite.lookAt(0, 0, 0);
        s.sunSprite.rotateY(Math.PI);
        s.sunSprite.visible = true;
        const sunAlpha = Math.max(0, Math.min(1, sunAltAz.altitude / 5));
        (s.sunSprite.material as THREE.MeshBasicMaterial).opacity = sunAlpha;
      } else {
        s.sunSprite.visible = false;
      }

      const skyCol = skyColors(sunAltAz.altitude);
      s.domeMaterial.uniforms.uZenithColor.value.set(...skyCol.zenith);
      s.domeMaterial.uniforms.uHorizonColor.value.set(...skyCol.horizon);
      s.domeMaterial.uniforms.uSunGlowColor.value.set(...skyCol.sunGlow);
      s.domeMaterial.uniforms.uBrightness.value = skyCol.brightness;

      if (sunAltAz.altitude > -10) {
        const altRad = sunAltAz.altitude * (Math.PI / 180);
        const azRad = sunAltAz.azimuth * (Math.PI / 180);
        const sunDir = new THREE.Vector3(
          Math.cos(altRad) * Math.cos(azRad),
          Math.sin(altRad),
          Math.cos(altRad) * Math.sin(azRad),
        ).normalize();
        s.domeMaterial.uniforms.uSunDirection.value.copy(sunDir);
      }

      s.starMaterial.uniforms.uTime.value = elapsed;
      s.starMaterial.uniforms.uBrightness.value = skyCol.brightness;

      (s.constellationLine.material as THREE.LineBasicMaterial).opacity =
        0.15 * (1 - skyCol.brightness * 0.9);

      let targetAmbientInt = 0;
      let targetHemiInt = 0;
      const targetLightColors: THREE.Color[] = [];
      const targetLightInts: number[] = [];

      // Use activeMode and tie intensity to the dome's fade for synchronized dimming
      const targetMode = s.activeMode;
      const isTargetSkyMode = targetMode === "sky";
      const fadeOpacity = (s.fadeSphere.material as THREE.ShaderMaterial)
        .uniforms.uOpacity.value;
      const dimFactor = Math.max(0, 1.0 - fadeOpacity); // 0 when fully black, 1 when fully visible

      if (isTargetSkyMode) {
        targetAmbientInt = 0.5 + skyCol.brightness * 2.5;
        targetHemiInt = 0.2 + skyCol.brightness * 2.3;

        for (let li = 0; li < s.roomLights.length; li++) {
          let c = new THREE.Color();
          let intensity = 0;
          if (li >= s.roomLights.length - 2) {
            intensity = 0.8 + skyCol.brightness * 6.0;
            if (skyCol.brightness > 0.3) {
              c.setHex(0x8899cc);
            } else {
              c.setHex(0x3a4a6a);
            }
          } else {
            intensity = 1.5 + skyCol.brightness * 1.5;
            c.setHex(0x2a3a5a);
          }
          targetLightColors.push(c);
          targetLightInts.push(intensity);
        }
      } else {
        const coveIntensity = s.currentCoveIntensity;
        const coveColorObj = s.domeMaterial.uniforms.uCoveColor
          .value as THREE.Color;
        const isMovie = targetMode === "movie";

        // --- Video Ambilight Extraction ---
        if (
          isMovie &&
          mediaElementRef.current &&
          (mediaElementRef.current instanceof HTMLVideoElement
            ? mediaElementRef.current.readyState >= 2
            : mediaElementRef.current.complete)
        ) {
          if (s.frameCount % 4 === 0) {
            try {
              s.videoCtx.drawImage(mediaElementRef.current, 0, 0, 16, 16);
              const imgData = s.videoCtx.getImageData(0, 0, 16, 16).data;
              let r = 0,
                g = 0,
                b = 0;
              for (let i = 0; i < imgData.length; i += 4) {
                r += imgData[i];
                g += imgData[i + 1];
                b += imgData[i + 2];
              }
              const count = 16 * 16 * 255;
              s.targetVideoColor.setRGB(r / count, g / count, b / count);
            } catch (err) {
              s.targetVideoColor.setHex(0x334455);
            }
          }
        } else {
          s.targetVideoColor.setHex(0x334455);
        }
        s.currentVideoColor.lerp(s.targetVideoColor, dt * 5.0);
        s.frameCount++;

        const vBright =
          0.299 * s.currentVideoColor.r +
          0.587 * s.currentVideoColor.g +
          0.114 * s.currentVideoColor.b;

        targetAmbientInt =
          (isMovie ? 0.1 + vBright * 0.6 : 0.0) +
          coveIntensity * 0.4 +
          wallIntensity * 1.5;
        targetHemiInt =
          (isMovie ? 0.05 + vBright * 0.4 : 0.0) +
          coveIntensity * 0.3 +
          wallIntensity * 1.0;

        for (let li = 0; li < s.roomLights.length; li++) {
          const baseColor = isMovie
            ? s.currentVideoColor
            : new THREE.Color(0x1a2038);
          let c = new THREE.Color();
          if (coveIntensity > 0.05) {
            c.copy(baseColor).lerp(
              coveColorObj,
              Math.min(1.0, coveIntensity * 0.6),
            );
          } else {
            c.copy(baseColor);
          }

          const baseIntensity = isMovie ? 0.1 + vBright * 6.0 : 0.0;
          let intensity = 0;
          if (li >= s.roomLights.length - 2) {
            intensity = baseIntensity + coveIntensity * 4.0; // Boosted to light up the projector more
          } else {
            intensity = baseIntensity * 0.5 + coveIntensity * 1.5;
          }
          targetLightColors.push(c);
          targetLightInts.push(intensity);
        }
      }

      // Fast base transition so the targets switch instantly when activeMode flips at 0.5s
      const lerpSpeed = dt * 20.0;

      if (s.ambient.userData.base === undefined)
        s.ambient.userData.base = s.ambient.intensity;
      s.ambient.userData.base +=
        (targetAmbientInt - s.ambient.userData.base) * lerpSpeed;
      if (Math.abs(s.ambient.userData.base - targetAmbientInt) < 0.001)
        s.ambient.userData.base = targetAmbientInt;
      s.ambient.intensity = s.ambient.userData.base * dimFactor;

      if (s.hemi.userData.base === undefined)
        s.hemi.userData.base = s.hemi.intensity;
      s.hemi.userData.base +=
        (targetHemiInt - s.hemi.userData.base) * lerpSpeed;
      if (Math.abs(s.hemi.userData.base - targetHemiInt) < 0.001)
        s.hemi.userData.base = targetHemiInt;
      s.hemi.intensity = s.hemi.userData.base * dimFactor;

      for (let li = 0; li < s.roomLights.length; li++) {
        const light = s.roomLights[li];
        light.color.lerp(targetLightColors[li], lerpSpeed);

        if (light.userData.base === undefined)
          light.userData.base = light.intensity;
        light.userData.base +=
          (targetLightInts[li] - light.userData.base) * lerpSpeed;
        if (Math.abs(light.userData.base - targetLightInts[li]) < 0.001)
          light.userData.base = targetLightInts[li];
        light.intensity = light.userData.base * dimFactor;
      }

      // Digital Projector Lens Glow Animation
      let lensGlow = 0.0;
      if (s.activeMode === "movie") {
        if (s.transitionState === "idle") {
          const avg =
            (s.currentVideoColor.r +
              s.currentVideoColor.g +
              s.currentVideoColor.b) /
            3.0;
          const baseBrightness = Math.max(avg, 0.3); // Ensure minimum visibility
          // Removed random flicker to keep the light steady
          lensGlow = baseBrightness * 2.0;
        } else if (s.transitionState === "fading_in") {
          lensGlow = 0.5; // Steady glow during fade
        }
      }

      s.lensMeshes.forEach((lens) => {
        const mat = lens.material as THREE.MeshStandardMaterial;
        mat.emissive.copy(s.currentVideoColor);
        mat.emissiveIntensity = lensGlow;
      });

      const dampFactor = 0.08;
      camYaw += (targetYaw - camYaw) * dampFactor;
      camPitch += (targetPitch - camPitch) * dampFactor;
      s.camYaw = camYaw;
      s.camPitch = camPitch;
      s.targetYaw = targetYaw;
      s.targetPitch = targetPitch;
      s.targetFov = targetFov;

      let moveForward = 0;
      let moveRight = 0;
      if (keys.w) moveForward += 1;
      if (keys.s) moveForward -= 1;
      if (keys.a) moveRight -= 1;
      if (keys.d) moveRight += 1;

      if (moveForward !== 0 || moveRight !== 0) {
        const speed = 30.0 * dt; // units per second

        // Normalize movement vector for diagonal movement
        const length = Math.sqrt(
          moveForward * moveForward + moveRight * moveRight,
        );
        moveForward /= length;
        moveRight /= length;

        const forwardX = Math.cos(camYaw);
        const forwardZ = Math.sin(camYaw);
        const rightX = Math.cos(camYaw + Math.PI / 2);
        const rightZ = Math.sin(camYaw + Math.PI / 2);

        camX += (forwardX * moveForward + rightX * moveRight) * speed;
        camZ += (forwardZ * moveForward + rightZ * moveRight) * speed;

        const dist = Math.sqrt(camX * camX + camZ * camZ);
        const maxDist = ROOM_RADIUS - 2;
        if (dist > maxDist) {
          camX = (camX / dist) * maxDist;
          camZ = (camZ / dist) * maxDist;
        }

        s.camera.position.set(camX, camY, camZ);
      }

      const currentFov = s.camera.fov;
      const newFov = currentFov + (targetFov - currentFov) * 0.1;
      if (Math.abs(newFov - currentFov) > 0.01) {
        s.camera.fov = newFov;
        s.camera.updateProjectionMatrix();
      }

      updateCameraLook();

      s.renderer.render(s.scene, s.camera);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      renderer.dispose();
      domeMaterial.dispose();
      lobbyMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      constellationGeo.dispose();
      constellationMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── Mode & Video Material Hook ──────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    let activeMaterial: THREE.Material;
    let mediaTexture: THREE.Texture | null = null;
    let videoMaterial: THREE.Material | null = null;

    if (appMode === "lobby") {
      activeMaterial = s.lobbyMaterial;
    } else if (appMode === "movie") {
      if (mediaElement) {
        if (mediaElement instanceof HTMLVideoElement) {
          mediaTexture = new THREE.VideoTexture(mediaElement);
        } else {
          mediaTexture = new THREE.Texture(mediaElement);
          mediaTexture.needsUpdate = true;
        }
        mediaTexture.minFilter = THREE.LinearFilter;
        mediaTexture.magFilter = THREE.LinearFilter;

        if (videoFormat === "equirectangular") {
          mediaTexture.repeat.set(1, 1);
          mediaTexture.offset.set(0, 0);
          videoMaterial = new THREE.ShaderMaterial({
            vertexShader: FISHEYE_VERTEX_SHADER,
            fragmentShader: EQUIRECTANGULAR_FRAGMENT_SHADER,
            uniforms: {
              tVideo: { value: mediaTexture },
              uCoveColor: { value: new THREE.Color(coveColor) },
              uCoveIntensity: { value: coveLight ? 1.5 : 0.0 },
            },
            side: THREE.BackSide,
          });
        } else {
          mediaTexture.repeat.set(1, 1);
          mediaTexture.offset.set(0, 0);
          videoMaterial = new THREE.ShaderMaterial({
            vertexShader: FISHEYE_VERTEX_SHADER,
            fragmentShader: FISHEYE_FRAGMENT_SHADER,
            uniforms: {
              tVideo: { value: mediaTexture },
              uCoveColor: { value: new THREE.Color(coveColor) },
              uCoveIntensity: { value: coveLight ? 1.5 : 0.0 },
            },
            side: THREE.BackSide,
          });
        }
        activeMaterial = videoMaterial;
      } else {
        // Dark default for movie mode when no media is loaded
        activeMaterial = s.lobbyMaterial;
      }
    } else {
      // Default to sky material for 'sky' mode
      activeMaterial = s.domeMaterial;
    }

    const prevMode = prevModeRef.current;
    s.pendingMaterial = activeMaterial;
    s.pendingMode = appMode;
    prevModeRef.current = appMode;

    // Trigger transition if switching to a new material or mode
    if (
      s.dome.material !== activeMaterial ||
      prevMode !== appMode ||
      s.transitionState !== "idle"
    ) {
      s.transitionState = "fading_out";
    } else {
      // If same material and mode, ensure visibilities are updated instantly
      const isSkyMode = appMode === "sky";
      s.stars.visible = isSkyMode;
      s.sunSprite.visible = isSkyMode;
      s.constellationLine.visible = showConstellationsRef.current && isSkyMode;
    }

    return () => {
      if (mediaTexture) mediaTexture.dispose();
      if (videoMaterial) videoMaterial.dispose();
    };
  }, [appMode, mediaElement, videoFormat]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    const color = new THREE.Color(coveColor);
    // Cove intensity is forced off in 'sky' mode
    const intensity = coveLight && appMode !== "sky" ? 1.5 : 0.0;
    const wallInt = wallLight && appMode !== "sky" ? 1.0 : 0.0;

    s.targetCoveIntensity = intensity;
    s.targetWallLightIntensity = wallInt;

    // Instantly update color on all materials to avoid complex color lerping across materials
    if (s.domeMaterial.uniforms.uCoveColor) {
      s.domeMaterial.uniforms.uCoveColor.value.copy(color);
    }
    if (s.lobbyMaterial.uniforms.uCoveColor) {
      s.lobbyMaterial.uniforms.uCoveColor.value.copy(color);
    }
    const fadeMat = s.fadeSphere.material as THREE.ShaderMaterial;
    if (fadeMat.uniforms && fadeMat.uniforms.uCoveColor) {
      fadeMat.uniforms.uCoveColor.value.copy(color);
    }
    const currentMat = s.dome.material as any;
    if (
      currentMat !== s.domeMaterial &&
      currentMat !== s.lobbyMaterial &&
      currentMat.uniforms &&
      currentMat.uniforms.uCoveColor
    ) {
      currentMat.uniforms.uCoveColor.value.copy(color);
    }
  }, [coveLight, coveColor, appMode, wallLight]);

  return (
    <div
      ref={containerRef}
      className="planetarium-canvas"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
