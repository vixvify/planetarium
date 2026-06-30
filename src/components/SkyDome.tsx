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

interface SkyDomeProps {
  simulationDate: Date;
  latitude: number;
  longitude: number;
  showConstellations: boolean;
  showLabels: boolean;
}

const DOME_RADIUS = 80;
const DOME_HEIGHT = 95;
const WALL_HEIGHT = 25;
const ROOM_RADIUS = DOME_RADIUS;
const FLOOR_Y = -WALL_HEIGHT;
const SEAT_ROWS = 6;
const PROJECTOR_HEIGHT = 12;

export default function SkyDome({
  simulationDate,
  latitude,
  longitude,
  showConstellations,
  showLabels,
}: SkyDomeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    domeMaterial: THREE.ShaderMaterial;
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
  const showLabelsRef = useRef(showLabels);

  simulationDateRef.current = simulationDate;
  latRef.current = latitude;
  lonRef.current = longitude;
  showConstellationsRef.current = showConstellations;
  showLabelsRef.current = showLabels;

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
      color: 0x2a2a35, 
      roughness: 0.8,
      metalness: 0.2,
    });
    const seatCushionMaterial = new THREE.MeshStandardMaterial({
      color: 0xcb366f, 
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
      const rowRadius = 25 + row * 12;
      const seatCount = Math.floor(14 + row * 8);
      const rowY = FLOOR_Y + 0.5 + row * 1.8; 
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
      const light = new THREE.PointLight(0x2a3a5a, 1.0, 50);
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

    const seatAngle = Math.PI * 0.75;
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
        uZenithColor: { value: new THREE.Vector3(0, 0, 0.02) },
        uHorizonColor: { value: new THREE.Vector3(0.01, 0.01, 0.03) },
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uSunGlowColor: { value: new THREE.Vector3(0, 0, 0) },
        uBrightness: { value: 0 },
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

    sceneRef.current = {
      renderer,
      scene,
      camera,
      domeMaterial: domeMaterial,
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
      const elapsed = s.clock.getElapsedTime();

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

      s.constellationLine.visible = showConst;
      if (showConst) {
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
        s.sunSprite.visible = true;
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
        s.moonSprite.visible = true;
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

      const dayMultiplier = 1.0 + skyCol.brightness * 5.0;

      s.ambient.intensity = 0.5 + skyCol.brightness * 2.5;
      s.hemi.intensity = 0.2 + skyCol.brightness * 2.3;

      for (let li = 0; li < s.roomLights.length; li++) {
        const light = s.roomLights[li];
        if (li >= s.roomLights.length - 5) {

          light.intensity = 0.8 + skyCol.brightness * 6.0;
          if (skyCol.brightness > 0.3) {
            light.color.setHex(0x8899cc);
          } else {
            light.color.setHex(0x3a4a6a);
          }
        } else {

          light.intensity = 1.5 + skyCol.brightness * 1.5;
        }
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
      starGeometry.dispose();
      starMaterial.dispose();
      constellationGeo.dispose();
      constellationMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

  }, []);

  return <div ref={containerRef} className="planetarium-canvas" />;
}
