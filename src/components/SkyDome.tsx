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

  float sunDot = max(dot(dir, uSunDirection), 0.0);
  float sunGlow = pow(sunDot, 6.0) * 0.5;
  float sunCore = pow(sunDot, 48.0) * 1.5;
  sky += uSunGlowColor * (sunGlow + sunCore) * uBrightness;

  float horizonFade = 1.0 - smoothstep(0.0, 0.12, h);
  sky += uHorizonColor * horizonFade * 0.2 * uBrightness;

  // Cove Light Effect (adjusted to reach higher up the dome)
  float coveFade = exp(-h * 4.0); 
  sky += uCoveColor * coveFade * uCoveIntensity;

  float gridU = fract(vUv.x * 120.0);
  float gridV = fract(vUv.y * 60.0);
  float grid = smoothstep(0.02, 0.0, min(gridU, gridV));
  sky = mix(sky, sky * 0.92, grid * 0.06);

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

const FISHEYE_VERTEX_SHADER = `
varying vec3 vWorldDirection;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldDirection = normalize(worldPos.xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LOBBY_FRAGMENT_SHADER = `
uniform vec3 uCoveColor;
uniform float uCoveIntensity;
varying vec3 vWorldPosition;

void main() {
  vec3 dir = normalize(vWorldPosition);
  float h = max(dir.y, 0.0);
  
  // A dark subtle base for the lobby dome
  vec3 color = vec3(0.005, 0.005, 0.01);
  
  // Cove Light Effect
  float coveFade = exp(-h * 4.0);
  color += uCoveColor * coveFade * uCoveIntensity;
  
  gl_FragColor = vec4(color, 1.0);
}
`;

const FISHEYE_FRAGMENT_SHADER = `
uniform sampler2D tVideo;
uniform vec3 uCoveColor;
uniform float uCoveIntensity;
varying vec3 vWorldDirection;

#define PI 3.14159265359

void main() {
  vec3 dir = normalize(vWorldDirection);
  
  float altitude = asin(max(0.0, dir.y));
  float r = (1.0 - (altitude / (PI / 2.0))) * 0.5;
  
  float azimuth = atan(dir.z, dir.x);
  
  float u = 0.5 + r * cos(azimuth);
  float v = 0.5 - r * sin(azimuth);
  
  vec3 finalColor = texture2D(tVideo, vec2(u, v)).rgb;
  
  // Cove Light Effect (adjusted for higher spread)
  float coveFade = exp(-altitude * 4.0);
  finalColor += uCoveColor * coveFade * uCoveIntensity;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface SkyDomeProps {
  simulationDate: Date;
  latitude: number;
  longitude: number;
  showConstellations: boolean;
  showLabels: boolean;
  appMode: "lobby" | "sky" | "movie";
  videoElement?: HTMLVideoElement | null;
  videoFormat?: "fisheye" | "equirectangular";
  coveLight?: boolean;
  coveColor?: string;
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
  appMode,
  videoElement,
  videoFormat = "fisheye",
  coveLight = true,
  coveColor = "#aa00ff",
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
    sunSprite: THREE.Sprite;
    moonSprite: THREE.Sprite;
    roomLights: THREE.PointLight[];
    ambient: THREE.AmbientLight;
    hemi: THREE.HemisphereLight;
    animationId: number;
    clock: THREE.Clock;

    targetCoveIntensity: number;
    currentCoveIntensity: number;
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
  } | null>(null);

  const simulationDateRef = useRef(simulationDate);
  const latRef = useRef(latitude);
  const lonRef = useRef(longitude);
  const showConstellationsRef = useRef(showConstellations);
  const prevModeRef = useRef(appMode);
  const videoElementRef = useRef(videoElement);

  simulationDateRef.current = simulationDate;
  latRef.current = latitude;
  lonRef.current = longitude;
  showConstellationsRef.current = showConstellations;
  videoElementRef.current = videoElement;

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
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x22222a,
      roughness: 0.8,
      metalness: 0.1,
    });
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0xddaa88,
      roughness: 0.8,
      metalness: 0.2,
    });
    const seatCushionMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa66,
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
      color: 0x2a3a58,
      emissive: 0x0e1c38,
      emissiveIntensity: 0.5,
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

    for (let row = 0; row < SEAT_ROWS; row++) {
      const rowRadius = 20 + row * 7;
      const seatCount = Math.floor(16 + row * 10);
      const rowY = FLOOR_Y + 0.5; // All seats at the same level
      const angleStep = (Math.PI * 2) / seatCount;

      for (let s = 0; s < seatCount; s++) {
        const angle = s * angleStep;

        const aisleAngle = angle % (Math.PI / 2);
        if (aisleAngle < 0.15 || aisleAngle > Math.PI / 2 - 0.15) continue;

        const seatGroup = new THREE.Group();
        seatGroup.position.set(
          Math.cos(angle) * rowRadius,
          rowY,
          Math.sin(angle) * rowRadius,
        );

        seatGroup.lookAt(0, rowY, 0);

        const backGeo = new THREE.BoxGeometry(2.6, 3.5, 0.5);
        const back = new THREE.Mesh(backGeo, seatCushionMaterial);
        back.position.set(0, 2.5, -1.2);
        back.rotation.x = -0.25;
        seatGroup.add(back);

        const cushionGeo = new THREE.BoxGeometry(2.6, 0.6, 2.4);
        const cushion = new THREE.Mesh(cushionGeo, seatCushionMaterial);
        cushion.position.set(0, 1.2, -0.1);
        cushion.rotation.x = 0.05;
        seatGroup.add(cushion);

        const pillarGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.0, 16);
        const pillar = new THREE.Mesh(pillarGeo, seatMaterial);
        pillar.position.set(0, 0.5, -0.5);
        seatGroup.add(pillar);

        const armGeo = new THREE.BoxGeometry(0.4, 0.8, 2.2);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(armGeo, seatMaterial);
          arm.position.set(side * 1.5, 1.6, -0.2);
          seatGroup.add(arm);
        }

        scene.add(seatGroup);
      }
    }

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
    projectorGroup.position.set(0, FLOOR_Y + 1.5, 0);

    const pedGeo = new THREE.CylinderGeometry(2, 2.5, 6, 32);
    const ped = new THREE.Mesh(pedGeo, projectorMat);
    ped.position.y = 3;
    projectorGroup.add(ped);

    const forkBaseGeo = new THREE.CylinderGeometry(2.5, 2.5, 1, 32);
    const forkBase = new THREE.Mesh(forkBaseGeo, projectorMat);
    forkBase.position.y = 6.5;
    projectorGroup.add(forkBase);

    for (const side of [-1, 1]) {
      const armGeo = new THREE.BoxGeometry(1.2, 6, 3);
      const arm = new THREE.Mesh(armGeo, projectorMat);
      arm.position.set(side * 3, 9.5, 0);
      projectorGroup.add(arm);
    }

    const sphereGeo = new THREE.IcosahedronGeometry(3.5, 3);
    const sphere = new THREE.Mesh(sphereGeo, projectorMat);
    sphere.position.y = 10.5;

    const lensPlacer = new THREE.IcosahedronGeometry(3.6, 1);
    const posAttr = lensPlacer.getAttribute("position");
    for (let v = 0; v < posAttr.count; v++) {
      const vx = posAttr.getX(v),
        vy = posAttr.getY(v),
        vz = posAttr.getZ(v);
      const portGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 8);
      const port = new THREE.Mesh(portGeo, fenceMetalMaterial);
      port.position.set(vx, vy, vz);
      port.lookAt(vx * 2, vy * 2, vz * 2);
      port.rotateX(Math.PI / 2);
      sphere.add(port);
    }

    sphere.rotation.x = -Math.PI / 6;
    sphere.rotation.z = Math.PI / 12;
    projectorGroup.add(sphere);

    scene.add(projectorGroup);

    const roomLights: THREE.PointLight[] = [];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const light = new THREE.PointLight(0x2a3a5a, 1.0, 150);
      light.position.set(
        Math.cos(angle) * (ROOM_RADIUS - 3),
        FLOOR_Y + 5,
        Math.sin(angle) * (ROOM_RADIUS - 3),
      );
      scene.add(light);
      roomLights.push(light);
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

    return { roomLights, ambient, hemi };
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
    const camX = Math.cos(seatAngle) * seatRadius;
    const camY = FLOOR_Y + 8;
    const camZ = Math.sin(seatAngle) * seatRadius;
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

    const { roomLights, ambient, hemi } = buildInterior(scene);

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

    const sunTex = createGlowTexture("rgba(255, 230, 120, 1)");
    const sunMat = new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sunSprite = new THREE.Sprite(sunMat);
    sunSprite.scale.set(25, 25, 1);
    scene.add(sunSprite);

    const moonTex = createGlowTexture("rgba(210, 225, 255, 1)");
    const moonMat = new THREE.SpriteMaterial({
      map: moonTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const moonSprite = new THREE.Sprite(moonMat);
    moonSprite.scale.set(14, 14, 1);
    scene.add(moonSprite);

    const dirs = [
      { label: "N", az: 0 },
      { label: "E", az: 90 },
      { label: "S", az: 180 },
      { label: "W", az: 270 },
    ];
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
    }

    const clock = new THREE.Clock();

    const fadeGeo = new THREE.SphereGeometry(DOME_RADIUS - 0.5, 64, 32);
    const fadeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.0,
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
      sunSprite,
      moonSprite,
      roomLights,
      ambient,
      hemi,
      animationId: 0,
      clock,
      targetCoveIntensity: coveLight ? 1.5 : 0.0,
      currentCoveIntensity: coveLight ? 1.5 : 0.0,
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
    };

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

      const alt = Math.max(0, altitude) * (Math.PI / 180);
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
      const showConst = showConstellationsRef.current;

      const jd = dateToJD(date);
      const localST = lst(jd, lon);
      const dt = Math.min(0.1, s.clock.getDelta());
      const elapsed = s.clock.elapsedTime;

      // Cove Intensity Smooth Fade
      if (Math.abs(s.currentCoveIntensity - s.targetCoveIntensity) > 0.005) {
        s.currentCoveIntensity +=
          (s.targetCoveIntensity - s.currentCoveIntensity) * 5.0 * dt;
      } else {
        s.currentCoveIntensity = s.targetCoveIntensity;
      }
      const currentMat = s.dome.material as any;
      if (currentMat.uniforms && currentMat.uniforms.uCoveIntensity) {
        currentMat.uniforms.uCoveIntensity.value = s.currentCoveIntensity;
      }

      // Mode Transition Fading
      if (s.transitionState === "fading_out") {
        const mat = s.fadeSphere.material as THREE.Material;
        mat.opacity += 2.0 * dt; // 0.5s fade to black
        if (mat.opacity >= 1.0) {
          mat.opacity = 1.0;
          s.transitionState = "fading_in";

          s.dome.material = s.pendingMaterial;
          s.activeMode = s.pendingMode;
          const isSkyMode = s.pendingMode === "sky";
          s.stars.visible = isSkyMode;
          s.sunSprite.visible = isSkyMode;
          s.moonSprite.visible = isSkyMode;
          s.constellationLine.visible = showConst && isSkyMode;
        }
      } else if (s.transitionState === "fading_in") {
        const mat = s.fadeSphere.material as THREE.Material;
        mat.opacity -= 2.0 * dt; // 0.5s fade from black
        if (mat.opacity <= 0.0) {
          mat.opacity = 0.0;
          s.transitionState = "idle";
        }
      }

      for (let i = 0; i < STARS.length; i++) {
        const star = STARS[i];
        const altAz = raDecToAltAz(star.ra, star.dec, lat, localST);

        if (altAz.altitude > -2) {
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

      const currentMode = s.pendingMode;
      const isSkyMode = currentMode === "sky";

      // Removed instant visibility toggles, they are now handled by the transition swap

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

            if (alt1 > -2 && alt2 > -2) {
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

      const sun = sunPosition(jd);
      const sunAltAz = raDecToAltAz(sun.ra, sun.dec, lat, localST);

      if (sunAltAz.altitude > -5) {
        const [sx, sy, sz] = raDecToDome(
          sun.ra,
          sun.dec,
          lat,
          localST,
          DOME_RADIUS - 4,
        );
        s.sunSprite.position.set(sx, Math.max(sy, 2), sz);
        s.sunSprite.visible = isSkyMode;
        const sunAlpha = Math.max(0, Math.min(1, (sunAltAz.altitude + 5) / 10));
        (s.sunSprite.material as THREE.SpriteMaterial).opacity = sunAlpha;
      } else {
        s.sunSprite.visible = false;
      }

      const moon = moonPosition(jd);
      const moonAltAz = raDecToAltAz(moon.ra, moon.dec, lat, localST);

      if (moonAltAz.altitude > -3) {
        const [mx, my, mz] = raDecToDome(
          moon.ra,
          moon.dec,
          lat,
          localST,
          DOME_RADIUS - 4,
        );
        s.moonSprite.position.set(mx, Math.max(my, 2), mz);
        s.moonSprite.visible = isSkyMode;
        const moonBright =
          0.3 + 0.7 * Math.abs(Math.cos(moon.phase * Math.PI * 2 - Math.PI));
        (s.moonSprite.material as THREE.SpriteMaterial).opacity =
          moonBright * Math.max(0, Math.min(1, (moonAltAz.altitude + 3) / 6));
      } else {
        s.moonSprite.visible = false;
      }

      const skyCol = skyColors(sunAltAz.altitude);
      s.domeMaterial.uniforms.uZenithColor.value.set(...skyCol.zenith);
      s.domeMaterial.uniforms.uHorizonColor.value.set(...skyCol.horizon);
      s.domeMaterial.uniforms.uSunGlowColor.value.set(...skyCol.sunGlow);
      s.domeMaterial.uniforms.uBrightness.value = skyCol.brightness;

      if (sunAltAz.altitude > -10) {
        const altRad = Math.max(0, sunAltAz.altitude) * (Math.PI / 180);
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
      const isTargetSkyMode = targetMode === 'sky';
      const fadeOpacity = (s.fadeSphere.material as THREE.Material).opacity;
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
        const coveColorObj = s.domeMaterial.uniforms.uCoveColor.value as THREE.Color;
        const isMovie = targetMode === "movie";

        // --- Video Ambilight Extraction ---
        if (
          isMovie &&
          videoElementRef.current &&
          videoElementRef.current.readyState >= 2
        ) {
          if (s.frameCount % 4 === 0) {
            try {
              s.videoCtx.drawImage(videoElementRef.current, 0, 0, 16, 16);
              const imgData = s.videoCtx.getImageData(0, 0, 16, 16).data;
              let r = 0, g = 0, b = 0;
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

        targetAmbientInt = (isMovie ? 0.1 + vBright * 0.6 : 0.0) + coveIntensity * 0.4;
        targetHemiInt = (isMovie ? 0.05 + vBright * 0.4 : 0.0) + coveIntensity * 0.3;

        for (let li = 0; li < s.roomLights.length; li++) {
          const baseColor = isMovie
            ? s.currentVideoColor
            : new THREE.Color(0x1a2038);
          let c = new THREE.Color();
          if (coveIntensity > 0.05) {
            c.copy(baseColor).lerp(coveColorObj, Math.min(1.0, coveIntensity * 0.6));
          } else {
            c.copy(baseColor);
          }

          const baseIntensity = isMovie ? 0.1 + vBright * 6.0 : 0.0;
          let intensity = 0;
          if (li >= s.roomLights.length - 2) {
            intensity = baseIntensity + coveIntensity * 2.0;
          } else {
            intensity = baseIntensity * 0.5 + coveIntensity * 1.5;
          }
          targetLightColors.push(c);
          targetLightInts.push(intensity);
        }
      }

      // Smoothly interpolate the base targets, then apply the strict dimFactor
      const lerpSpeed = dt * 3.0; // 3 units per second smooth transition
      
      if (s.ambient.userData.base === undefined) s.ambient.userData.base = s.ambient.intensity;
      s.ambient.userData.base += (targetAmbientInt - s.ambient.userData.base) * lerpSpeed;
      if (Math.abs(s.ambient.userData.base - targetAmbientInt) < 0.001) s.ambient.userData.base = targetAmbientInt;
      s.ambient.intensity = s.ambient.userData.base * dimFactor;

      if (s.hemi.userData.base === undefined) s.hemi.userData.base = s.hemi.intensity;
      s.hemi.userData.base += (targetHemiInt - s.hemi.userData.base) * lerpSpeed;
      if (Math.abs(s.hemi.userData.base - targetHemiInt) < 0.001) s.hemi.userData.base = targetHemiInt;
      s.hemi.intensity = s.hemi.userData.base * dimFactor;

      for (let li = 0; li < s.roomLights.length; li++) {
        const light = s.roomLights[li];
        light.color.lerp(targetLightColors[li], lerpSpeed);
        
        if (light.userData.base === undefined) light.userData.base = light.intensity;
        light.userData.base += (targetLightInts[li] - light.userData.base) * lerpSpeed;
        if (Math.abs(light.userData.base - targetLightInts[li]) < 0.001) light.userData.base = targetLightInts[li];
        light.intensity = light.userData.base * dimFactor;
      }

      const dampFactor = 0.08;
      camYaw += (targetYaw - camYaw) * dampFactor;
      camPitch += (targetPitch - camPitch) * dampFactor;
      s.camYaw = camYaw;
      s.camPitch = camPitch;
      s.targetYaw = targetYaw;
      s.targetPitch = targetPitch;
      s.targetFov = targetFov;

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
    let videoTexture: THREE.VideoTexture | null = null;
    let videoMaterial: THREE.Material | null = null;

    if (appMode === "lobby") {
      activeMaterial = s.lobbyMaterial;
    } else if (appMode === "movie") {
      if (videoElement) {
        videoTexture = new THREE.VideoTexture(videoElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;

        if (videoFormat === "equirectangular") {
          videoTexture.repeat.set(1, 0.5);
          videoTexture.offset.set(0, 0.5);
          videoMaterial = new THREE.MeshBasicMaterial({
            map: videoTexture,
            side: THREE.BackSide,
          });
        } else {
          videoTexture.repeat.set(1, 1);
          videoTexture.offset.set(0, 0);
          videoMaterial = new THREE.ShaderMaterial({
            vertexShader: FISHEYE_VERTEX_SHADER,
            fragmentShader: FISHEYE_FRAGMENT_SHADER,
            uniforms: {
              tVideo: { value: videoTexture },
              uCoveColor: { value: new THREE.Color(coveColor) },
              uCoveIntensity: { value: coveLight ? 1.5 : 0.0 },
            },
            side: THREE.BackSide,
          });
        }
        activeMaterial = videoMaterial;
      } else {
        // Dark default for movie mode when no video is loaded
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
      s.moonSprite.visible = isSkyMode;
      s.constellationLine.visible = showConstellationsRef.current && isSkyMode;
    }

    return () => {
      if (videoTexture) videoTexture.dispose();
      if (videoMaterial) videoMaterial.dispose();
    };
  }, [appMode, videoElement, videoFormat]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    const color = new THREE.Color(coveColor);
    // Cove intensity is forced off in 'sky' mode
    const intensity = coveLight && appMode !== "sky" ? 1.5 : 0.0;

    s.targetCoveIntensity = intensity;

    // Instantly update color on all materials to avoid complex color lerping across materials
    if (s.domeMaterial.uniforms.uCoveColor) {
      s.domeMaterial.uniforms.uCoveColor.value.copy(color);
    }
    if (s.lobbyMaterial.uniforms.uCoveColor) {
      s.lobbyMaterial.uniforms.uCoveColor.value.copy(color);
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
  }, [coveLight, coveColor, appMode]);

  return (
    <div
      ref={containerRef}
      className="planetarium-canvas"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
