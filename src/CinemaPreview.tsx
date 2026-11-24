import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Hall, Seat } from './geometry';
import { eyePoint } from './geometry';

export type PreviewStage = 'map' | 'moving' | 'seated' | 'returning';

type PreviewProps = {
  hall: Hall;
  seat: Seat;
  poster: string;
  hasSelection: boolean;
  stage: PreviewStage;
  onStageComplete: (stage: 'seated' | 'map') => void;
  onReadyChange: (ready: boolean) => void;
  forceFallback?: boolean;
};

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  screenCenter: THREE.Vector3;
  finalTarget: THREE.Vector3;
  mapPosition: THREE.Vector3;
  mapTarget: THREE.Vector3;
  mapUp: THREE.Vector3;
  eye: THREE.Vector3;
  selectedRing: THREE.Mesh;
  chairParts: Map<string, { back: THREE.Mesh; cushion: THREE.Mesh }>;
  baseBack: THREE.Material;
  baseCushion: THREE.Material;
  selectedBack: THREE.Material;
  selectedCushion: THREE.Material;
  texture: THREE.CanvasTexture;
  fabricTexture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  currentTarget: THREE.Vector3;
  currentUp: THREE.Vector3;
  frame: number;
  motionFrame: number;
  alive: boolean;
};

const FOV = 90;
const FLIGHT_MS = 1320;
const RETURN_MS = 1080;

function createVelvetTexture(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  const image = context.createImageData(canvas.width, canvas.height);
  let seed = 0x5eeda11;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      seed = (Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) | 0;
      let noise = seed;
      noise = Math.imul(noise ^ (noise >>> 7), 61 | noise);
      noise ^= noise + Math.imul(noise ^ (noise >>> 14), 9 | noise);
      const grain = ((noise ^ (noise >>> 13)) & 15) - 7;
      const weave = (x % 4 === 0 || y % 4 === 0) ? -3 : 0;
      const shade = grain + weave + Math.sin((x + y * 0.7) * 0.12) * 2.2;
      const index = (y * canvas.width + x) * 4;
      image.data[index] = Math.max(0, Math.min(255, 118 + shade));
      image.data[index + 1] = Math.max(0, Math.min(255, 27 + shade * 0.42));
      image.data[index + 2] = Math.max(0, Math.min(255, 34 + shade * 0.55));
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function CinemaPreview({ hall, seat, poster, hasSelection, stage, onStageComplete, onReadyChange, forceFallback = false }: PreviewProps) {
  const root = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const stageRef = useRef(stage);
  const stageCompleteRef = useRef(onStageComplete);
  const [failed, setFailed] = useState(false);
  const [reset, setReset] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => { stageCompleteRef.current = onStageComplete; }, [onStageComplete]);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  useEffect(() => {
    if (forceFallback) {
      setReady(true);
      onReadyChange(true);
      return;
    }
    const element = host.current;
    if (!element) return;
    setFailed(false);
    setReady(false);
    onReadyChange(false);

    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
    catch { setFailed(true); setReady(true); onReadyChange(true); return; }

    const maxDepth = Math.max(...hall.rows.map((row) => row.z));
    const maxX = Math.max(...hall.rows.flatMap((row) => row.xPositions.map(Math.abs)));
    const roomWidth = maxX * 2 + 3.2;
    const roomDepth = maxDepth + 8;
    const width = element.clientWidth || 900;
    const height = element.clientHeight || 420;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#060809');
    scene.fog = new THREE.Fog('#060809', 23, roomDepth + 18);
    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 150);
    const centerZ = maxDepth * 0.53;
    const aspect = width / height;
    const viewWidth = maxX * 2 + 1.3;
    const mapDistance = Math.max(13, viewWidth / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect));
    const mapPosition = new THREE.Vector3(0, mapDistance, centerZ);
    const mapTarget = new THREE.Vector3(0, 0, centerZ);
    const mapUp = new THREE.Vector3(0, 0, -1);
    const screenCenter = new THREE.Vector3(hall.screen.center.x, hall.screen.center.y, hall.screen.center.z);
    camera.up.copy(mapUp);
    camera.position.copy(mapPosition);
    camera.lookAt(mapTarget);

    scene.add(new THREE.HemisphereLight(0xc4b6a6, 0x080607, 0.36));
    scene.add(new THREE.AmbientLight(0x4b3830, 0.32));
    const screenGlow = new THREE.PointLight(0xffd9b4, 25, 22, 2);
    screenGlow.position.set(hall.screen.center.x, hall.screen.center.y + 0.35, hall.screen.center.z + 1.25);
    scene.add(screenGlow);
    const aisleLight = new THREE.PointLight(0xff9057, 3.2, 18, 2);
    aisleLight.position.set(0, 0.55, maxDepth * 0.62);
    scene.add(aisleLight);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: 0.96, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth + 2), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.17, roomDepth / 2 - 2);
    floor.receiveShadow = true;
    scene.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x100d0c, roughness: 0.94, metalness: 0.02 });
    const woodMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x241710, roughness: 0.88, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x1b120f, roughness: 0.92, metalness: 0.01 }),
    ];
    const woodTrim = new THREE.MeshStandardMaterial({ color: 0x382319, roughness: 0.8, metalness: 0.04 });
    const sconceFrame = new THREE.MeshStandardMaterial({ color: 0x241913, roughness: 0.52, metalness: 0.3 });
    const sconceGlow = new THREE.MeshBasicMaterial({ color: 0xffb36f, toneMapped: false });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 6.5, roomDepth), wallMaterial);
      wall.position.set(side * roomWidth / 2, 3.05, roomDepth / 2 - 2);
      wall.receiveShadow = true;
      scene.add(wall);
      const wallInsideX = side * (roomWidth / 2 - 0.118);
      const panelStep = 1.55;
      const panelStart = roomDepth / 2 - 2 - roomDepth / 2 + panelStep / 2;
      for (let index = 0; panelStart + index * panelStep < roomDepth - 2; index += 1) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 5.7, panelStep - 0.08), woodMaterials[index % woodMaterials.length]);
        panel.position.set(wallInsideX, 3.05, panelStart + index * panelStep);
        scene.add(panel);
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.075, 6.05, 0.045), woodTrim);
        upright.position.set(wallInsideX - side * 0.035, 3.05, panelStart + index * panelStep + panelStep / 2 - 0.02);
        scene.add(upright);
      }
      const wallRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, roomDepth * 0.86), new THREE.MeshStandardMaterial({ color: 0x44291d, emissive: 0x562315, emissiveIntensity: 0.12, roughness: 0.78 }));
      wallRail.position.set(side * (roomWidth / 2 - 0.17), 0.42, roomDepth / 2 - 2);
      scene.add(wallRail);
      for (const z of [0.8, 3, maxDepth * 0.52, maxDepth + 1.2]) {
        const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.82, 0.4), sconceFrame);
        fixture.position.set(side * (roomWidth / 2 - 0.22), 3.18, z);
        scene.add(fixture);
        const diffuser = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.59, 0.18), sconceGlow);
        diffuser.position.set(side * (roomWidth / 2 - 0.285), 3.18, z);
        scene.add(diffuser);
        if (z === 3 || z === maxDepth * 0.52) {
          const sconceLight = new THREE.PointLight(0xff9b5d, 4.1, 5.7, 2);
          sconceLight.position.set(side * (roomWidth / 2 - 0.7), 3.15, z);
          scene.add(sconceLight);
        }
      }
    }
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), new THREE.MeshStandardMaterial({ color: 0x100e0d, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 6.15, roomDepth / 2 - 2);
    scene.add(ceiling);
    const ceilingGridMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1715, roughness: 0.94, emissive: 0x0d0806, emissiveIntensity: 0.08 });
    const ceilingCenterZ = roomDepth / 2 - 2;
    for (let z = -roomDepth / 2 + 0.4; z < roomDepth / 2; z += 1.65) {
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.022, 0.035), ceilingGridMaterial);
      crossbar.position.set(0, 6.125, ceilingCenterZ + z);
      scene.add(crossbar);
    }
    for (let x = -roomWidth / 2 + 0.35; x < roomWidth / 2; x += 1.65) {
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, roomDepth), ceilingGridMaterial);
      runner.position.set(x, 6.125, ceilingCenterZ);
      scene.add(runner);
    }
    const downlightTrim = new THREE.MeshStandardMaterial({ color: 0x171411, roughness: 0.68, metalness: 0.22 });
    const downlight = new THREE.MeshBasicMaterial({ color: 0xffdfad, toneMapped: false });
    for (const z of [1.2, 3.7, 6.2, 8.7, 11.2]) {
      for (const x of [-1.75, 1.75]) {
        const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.045, 20), downlightTrim);
        trim.position.set(x, 6.085, z);
        scene.add(trim);
        const diffuser = new THREE.Mesh(new THREE.CircleGeometry(0.073, 20), downlight);
        diffuser.rotation.x = Math.PI / 2;
        diffuser.position.set(x, 6.058, z);
        scene.add(diffuser);
        if (z === 3.7) {
          const ceilingLight = new THREE.PointLight(0xffba79, 2.8, 6.5, 2);
          ceilingLight.position.set(x, 5.78, z);
          scene.add(ceilingLight);
        }
      }
    }

    const screenGroup = new THREE.Group();
    screenGroup.position.set(hall.screen.center.x, hall.screen.center.y, hall.screen.center.z);
    screenGroup.rotation.y = THREE.MathUtils.degToRad(hall.screen.yawDegrees);
    scene.add(screenGroup);
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = 1600;
    imageCanvas.height = 700;
    const context = imageCanvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, imageCanvas.width, imageCanvas.height);
      gradient.addColorStop(0, '#15222a'); gradient.addColorStop(1, '#bb7958');
      context.fillStyle = gradient; context.fillRect(0, 0, imageCanvas.width, imageCanvas.height);
    }
    const texture = new THREE.CanvasTexture(imageCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const image = new Image();
    image.decoding = 'async';
    const drawPoster = () => {
      if (!context || !image.naturalWidth) return;
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const canvasRatio = imageCanvas.width / imageCanvas.height;
      let sx = 0; let sy = 0; let sw = image.naturalWidth; let sh = image.naturalHeight;
      if (sourceRatio > canvasRatio) { sw = image.naturalHeight * canvasRatio; sx = (image.naturalWidth - sw) / 2; }
      else { sh = image.naturalWidth / canvasRatio; sy = (image.naturalHeight - sh) / 2; }
      context.drawImage(image, sx, sy, sw, sh, 0, 0, imageCanvas.width, imageCanvas.height);
      texture.needsUpdate = true;
    };
    const textureLoaded = new Promise<void>((resolve) => {
      image.onload = () => { drawPoster(); resolve(); };
      image.onerror = () => resolve();
      image.src = poster;
      if (image.complete && image.naturalWidth) { drawPoster(); resolve(); }
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(hall.screen.width, hall.screen.height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
    screen.position.z = -0.08;
    screenGroup.add(screen);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2425, emissive: 0x0c1113, roughness: 0.48, metalness: 0.25 });
    const frame = new THREE.Mesh(new RoundedBoxGeometry(hall.screen.width + 0.36, hall.screen.height + 0.28, 0.14, 2, 0.08), frameMaterial);
    frame.position.z = -0.18;
    screenGroup.add(frame);

    const fabricTexture = createVelvetTexture(renderer);
    const velvet = new THREE.MeshPhysicalMaterial({ color: 0xddd0cc, map: fabricTexture, emissive: 0x170307, emissiveIntensity: 0.24, roughness: 0.94, metalness: 0, clearcoat: 0.025, clearcoatRoughness: 0.96 });
    const backInset = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: fabricTexture, emissive: 0x170307, emissiveIntensity: 0.24, roughness: 0.92, metalness: 0, clearcoat: 0.025, clearcoatRoughness: 0.95 });
    const cushionMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: fabricTexture, emissive: 0x170307, emissiveIntensity: 0.24, roughness: 0.93, metalness: 0, clearcoat: 0.025, clearcoatRoughness: 0.96 });
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x282324, roughness: 0.62, metalness: 0.12 });
    const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x29292a, roughness: 0.52, metalness: 0.52 });
    const selectedBack = new THREE.MeshPhysicalMaterial({ color: 0x65d6a0, roughness: 0.72, emissive: 0x126342, emissiveIntensity: 0.45, clearcoat: 0.1 });
    const selectedCushion = new THREE.MeshPhysicalMaterial({ color: 0x79e4b0, roughness: 0.72, emissive: 0x176d47, emissiveIntensity: 0.4, clearcoat: 0.1 });
    const chairBackGeometry = new RoundedBoxGeometry(0.72, 0.88, 0.24, 6, 0.19);
    const chairInsetGeometry = new RoundedBoxGeometry(0.6, 0.74, 0.045, 6, 0.14);
    const cushionGeometry = new RoundedBoxGeometry(0.66, 0.2, 0.57, 6, 0.095);
    const armGeometry = new RoundedBoxGeometry(0.105, 0.18, 0.51, 4, 0.047);
    const legGeometry = new THREE.CylinderGeometry(0.022, 0.03, 0.27, 8);
    const chairParts = new Map<string, { back: THREE.Mesh; cushion: THREE.Mesh }>();

    for (const row of hall.rows) {
      const maxRowX = Math.max(...row.xPositions.map(Math.abs));
      const riser = new THREE.Mesh(new THREE.BoxGeometry(maxRowX * 2 + 1.2, 0.14, 0.72), new THREE.MeshStandardMaterial({ color: 0x111313, roughness: 0.92 }));
      riser.position.set(0, row.y - 0.06, row.z + 0.27);
      riser.receiveShadow = true;
      scene.add(riser);
      const aisleStrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.46), new THREE.MeshStandardMaterial({ color: 0xff9b60, emissive: 0x9b371b, emissiveIntensity: 0.48 }));
      const leftEdge = Math.max(...row.xPositions.filter((x) => x < 0));
      const rightEdge = Math.min(...row.xPositions.filter((x) => x > 0));
      const aisleCenter = (leftEdge + rightEdge) / 2;
      for (const side of [-1, 1]) {
        const strip = aisleStrip.clone();
        strip.position.set(aisleCenter + side * 0.38, row.y + 0.018, row.z + 0.1);
        scene.add(strip);
      }
      row.xPositions.forEach((x, index) => {
        const id = `${row.label}${index + 1}`;
        const chair = new THREE.Group();
        chair.position.set(x, row.y, row.z);
        const shell = new THREE.Mesh(chairBackGeometry, velvet);
        shell.scale.set(1.015, 1.015, 1.04);
        shell.position.set(0, 0.81, 0.18);
        const inset = new THREE.Mesh(chairInsetGeometry, backInset);
        inset.position.set(0, 0.81, 0.31);
        inset.castShadow = false;
        const cushion = new THREE.Mesh(cushionGeometry, cushionMaterial);
        cushion.position.set(0, 0.38, -0.055);
        cushion.castShadow = true;
        chair.add(shell, inset, cushion);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(armGeometry, armMaterial);
          arm.position.set(side * 0.345, 0.49, -0.015);
          chair.add(arm);
          const leg = new THREE.Mesh(legGeometry, supportMaterial);
          leg.position.set(side * 0.305, 0.2, 0.015);
          chair.add(leg);
        }
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.17, 8), supportMaterial);
        pedestal.position.set(0, 0.16, 0.04);
        chair.add(pedestal);
        chair.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
        chairParts.set(id, { back: inset, cushion });
        scene.add(chair);
      });
    }

    const selectedRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: 0x80edb5, toneMapped: false }));
    selectedRing.rotation.x = Math.PI / 2;
    selectedRing.visible = false;
    scene.add(selectedRing);

    const eye = new THREE.Vector3(0, 1.35, maxDepth / 2);
    let alive = true;
    void textureLoaded.then(() => {
      if (!alive) return;
      renderer.render(scene, camera);
      setReady(true); onReadyChange(true);
    });

    const onContextLost = (event: Event) => { event.preventDefault(); setFailed(true); setReady(true); onReadyChange(true); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    let dragging = false;
    let lastX = 0; let lastY = 0;
    const pointerDown = (event: PointerEvent) => {
      if (stageRef.current !== 'seated') return;
      dragging = true; lastX = event.clientX; lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging || stageRef.current !== 'seated') return;
      const dx = event.clientX - lastX; const dy = event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
      const direction = new THREE.Vector3().subVectors(state.currentTarget, camera.position).normalize();
      const spherical = new THREE.Spherical().setFromVector3(direction);
      const baseDirection = new THREE.Vector3().subVectors(state.finalTarget, state.eye).normalize();
      const base = new THREE.Spherical().setFromVector3(baseDirection);
      spherical.theta = THREE.MathUtils.clamp(spherical.theta - dx * 0.003, base.theta - 0.55, base.theta + 0.55);
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy * 0.003, 0.9, 2.25);
      const next = new THREE.Vector3().setFromSpherical(spherical).multiplyScalar(8).add(camera.position);
      state.currentTarget.copy(next);
      camera.lookAt(next);
      renderer.render(scene, camera);
    };
    const pointerUp = () => { dragging = false; };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    const resize = () => {
      if (!element.isConnected) return;
      const nextWidth = element.clientWidth; const nextHeight = element.clientHeight;
      if (!nextWidth || !nextHeight) return;
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const frameLoop = () => {
      if (!alive) return;
      renderer.render(scene, camera);
      state.frame = window.requestAnimationFrame(frameLoop);
    };
    const state: SceneState = {
      renderer, scene, camera, screenCenter, finalTarget: screenCenter.clone(), mapPosition, mapTarget, mapUp, eye,
      selectedRing, chairParts, baseBack: backInset, baseCushion: cushionMaterial,
      selectedBack, selectedCushion, texture, fabricTexture, canvas: imageCanvas,
      currentTarget: mapTarget.clone(), currentUp: mapUp.clone(), frame: 0,
      motionFrame: 0, alive: true,
    };
    sceneRef.current = state;
    state.frame = window.requestAnimationFrame(frameLoop);

    return () => {
      alive = false; state.alive = false;
      window.cancelAnimationFrame(state.frame); window.cancelAnimationFrame(state.motionFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      image.onload = null; image.onerror = null;
      renderer.dispose(); texture.dispose(); fabricTexture.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => materials.add(material));
        else if (mesh.material) materials.add(mesh.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      if (sceneRef.current === state) sceneRef.current = null;
      element.replaceChildren();
    };
  }, [hall, poster, forceFallback, onReadyChange]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;
    const selectedId = seat.id;
    for (const [id, parts] of state.chairParts) {
      const active = hasSelection && id === selectedId;
      parts.back.material = active ? state.selectedBack : state.baseBack;
      parts.cushion.material = active ? state.selectedCushion : state.baseCushion;
    }
    state.selectedRing.visible = hasSelection;
    state.selectedRing.position.set(seat.position.x, seat.position.y + 0.02, seat.position.z);
    const eye = eyePoint(seat);
    state.eye.set(eye.x, eye.y, eye.z);
    state.finalTarget.copy(state.screenCenter);
    const screenDistance = Math.hypot(state.screenCenter.x - eye.x, state.screenCenter.z - eye.z) || 1;
    const screenTopElevation = Math.atan2(state.screenCenter.y + hall.screen.height / 2 - eye.y, screenDistance);
    const desiredScreenTopElevation = Math.atan((0.5 - 0.24) * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    state.finalTarget.y = eye.y + Math.tan(screenTopElevation - desiredScreenTopElevation) * screenDistance;
  }, [seat, hall, hasSelection]);

  useEffect(() => {
    const state = sceneRef.current;
    if (!state || forceFallback || failed) {
      if (stage === 'moving') {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timeout = window.setTimeout(() => stageCompleteRef.current('seated'), reduced ? 0 : 120);
        return () => clearTimeout(timeout);
      }
      if (stage === 'returning') {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timeout = window.setTimeout(() => stageCompleteRef.current('map'), reduced ? 0 : 120);
        return () => clearTimeout(timeout);
      }
      return;
    }
    window.cancelAnimationFrame(state.motionFrame);
    if (stage === 'map') {
      state.camera.up.copy(state.mapUp);
      state.camera.position.copy(state.mapPosition);
      state.currentTarget.copy(state.mapTarget);
      state.currentUp.copy(state.mapUp);
      state.camera.lookAt(state.mapTarget);
      state.renderer.render(state.scene, state.camera);
      return;
    }
    if (stage === 'seated') {
      state.camera.position.copy(state.eye);
      state.camera.up.set(0, 1, 0);
      state.currentUp.set(0, 1, 0);
      state.currentTarget.copy(state.finalTarget);
      state.camera.lookAt(state.finalTarget);
      state.renderer.render(state.scene, state.camera);
      return;
    }
    const startPosition = stage === 'moving' ? state.mapPosition.clone() : state.camera.position.clone();
    const startTarget = stage === 'moving' ? state.mapTarget.clone() : state.currentTarget.clone();
    const startUp = stage === 'moving' ? state.mapUp.clone() : state.camera.up.clone();
    const endPosition = stage === 'moving' ? new THREE.Vector3(eyePoint(seat).x, eyePoint(seat).y, eyePoint(seat).z) : state.mapPosition.clone();
    const endTarget = stage === 'moving' ? state.finalTarget.clone() : state.mapTarget.clone();
    const endUp = stage === 'moving' ? new THREE.Vector3(0, 1, 0) : state.mapUp.clone();
    const startTime = performance.now() + (stage === 'moving' ? 140 : 0);
    const duration = stage === 'moving' ? FLIGHT_MS : RETURN_MS;
    const motion = (now: number) => {
      if (!state.alive) return;
      const raw = THREE.MathUtils.clamp((now - startTime) / duration, 0, 1);
      const eased = raw * raw * (3 - 2 * raw);
      const seatX = seat.position.x; const seatY = seat.position.y; const seatZ = seat.position.z;
      if (stage === 'moving') {
        const phase = eased;
        const top = new THREE.Vector3(seatX * 0.14, Math.max(12, state.mapPosition.y * 0.83), seatZ + 1.7);
        const drop = new THREE.Vector3(seatX, eyePoint(seat).y + 5.2, seatZ + 3.8);
        if (phase < 0.34) {
          const p = phase / 0.34; const q = p * p * (3 - 2 * p);
          state.camera.position.lerpVectors(startPosition, top, q);
          state.currentTarget.lerpVectors(startTarget, new THREE.Vector3(seatX, seatY, seatZ), q);
          state.currentUp.lerpVectors(startUp, new THREE.Vector3(0, 0, -1), q).normalize();
        } else if (phase < 0.67) {
          const p = (phase - 0.34) / 0.33; const q = p * p * (3 - 2 * p);
          state.camera.position.lerpVectors(top, drop, q);
          state.currentTarget.lerpVectors(new THREE.Vector3(seatX, seatY, seatZ), endTarget, q);
          state.currentUp.lerpVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), q).normalize();
        } else {
          const p = (phase - 0.67) / 0.33; const q = p * p * (3 - 2 * p);
          state.camera.position.lerpVectors(drop, endPosition, q);
          state.currentTarget.lerp(endTarget, q);
          state.currentUp.lerp(new THREE.Vector3(0, 1, 0), q).normalize();
        }
      } else {
        const drop = new THREE.Vector3(seatX, eyePoint(seat).y + 5.2, seatZ + 3.8);
        if (eased < 0.42) {
          const p = eased / 0.42; const q = p * p * (3 - 2 * p);
          state.camera.position.lerpVectors(startPosition, drop, q);
          state.currentTarget.lerpVectors(startTarget, new THREE.Vector3(seatX, seatY, seatZ), q);
          state.currentUp.lerpVectors(startUp, new THREE.Vector3(0, 0, -1), q).normalize();
        } else {
          const p = (eased - 0.42) / 0.58; const q = p * p * (3 - 2 * p);
          state.camera.position.lerpVectors(drop, endPosition, q);
          state.currentTarget.lerpVectors(new THREE.Vector3(seatX, seatY, seatZ), endTarget, q);
          state.currentUp.lerpVectors(new THREE.Vector3(0, 0, -1), endUp, q).normalize();
        }
      }
      state.camera.up.copy(state.currentUp);
      state.camera.lookAt(state.currentTarget);
      if (root.current) root.current.style.setProperty('--flight-progress', String(eased));
      if (raw < 1) state.motionFrame = window.requestAnimationFrame(motion);
      else {
        state.camera.position.copy(endPosition);
        state.currentTarget.copy(endTarget);
        state.camera.up.copy(endUp);
        state.camera.lookAt(endTarget);
        state.renderer.render(state.scene, state.camera);
        state.motionFrame = 0;
        if (root.current) root.current.style.setProperty('--flight-progress', '1');
        stageCompleteRef.current(stage === 'moving' ? 'seated' : 'map');
      }
      state.renderer.render(state.scene, state.camera);
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      state.camera.position.copy(endPosition); state.camera.up.copy(endUp); state.currentTarget.copy(endTarget); state.camera.lookAt(endTarget);
      state.renderer.render(state.scene, state.camera); stageCompleteRef.current(stage === 'moving' ? 'seated' : 'map');
    } else state.motionFrame = window.requestAnimationFrame(motion);
    return () => window.cancelAnimationFrame(state.motionFrame);
  }, [stage, seat, hall, failed, forceFallback, reset]);

  if (failed || forceFallback) {
    return <div className={`cinema-preview-shell fallback-shell ${stage}`} ref={root}>
      {stage === 'seated' ? <PerspectiveFallback hall={hall} seat={seat} poster={poster}/> : <div className="fallback-map-background" aria-hidden="true"/>}
    </div>;
  }
  return <div className={`cinema-preview-shell live-shell ${stage}`} ref={root}>
    <div className="preview-canvas" ref={host} role="img" aria-label={`Auditorium view from selected seat ${seat.row}${seat.number}`}/>
    {stage === 'seated' && <div className="preview-controls"><span>VIEW FROM {seat.row}{seat.number}</span><button onClick={() => setReset((value) => value + 1)}>Reset view</button></div>}
    {!ready && <div className="scene-loading" aria-hidden="true"/>}
  </div>;
}

function PerspectiveFallback({ hall, seat, poster }: { hall: Hall; seat: Seat; poster: string }) {
  const screen = hall.screen;
  const half = screen.width / 2;
  const yaw = screen.yawDegrees * Math.PI / 180;
  const axis = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const center = screen.center;
  const points3d = [
    { x: center.x - axis.x * half, y: center.y + screen.height / 2, z: center.z - axis.z * half },
    { x: center.x + axis.x * half, y: center.y + screen.height / 2, z: center.z + axis.z * half },
    { x: center.x + axis.x * half, y: center.y - screen.height / 2, z: center.z + axis.z * half },
    { x: center.x - axis.x * half, y: center.y - screen.height / 2, z: center.z - axis.z * half },
  ];
  const eye = eyePoint(seat);
  const forwardLength = Math.hypot(center.x - eye.x, center.y - eye.y, center.z - eye.z) || 1;
  const forward = { x: (center.x - eye.x) / forwardLength, y: (center.y - eye.y) / forwardLength, z: (center.z - eye.z) / forwardLength };
  const rightLength = Math.hypot(forward.z, forward.x) || 1;
  const right = { x: -forward.z / rightLength, y: 0, z: forward.x / rightLength };
  const up = { x: right.y * forward.z - right.z * forward.y, y: right.z * forward.x - right.x * forward.z, z: right.x * forward.y - right.y * forward.x };
  const fov = FOV * Math.PI / 180; const aspect = 900 / 440; const scale = 1 / Math.tan(fov / 2);
  const projected = points3d.map((point) => {
    const x = point.x - eye.x; const y = point.y - eye.y; const z = point.z - eye.z;
    const depth = Math.max(0.1, x * forward.x + y * forward.y + z * forward.z);
    return { x: 450 + ((x * right.x + y * right.y + z * right.z) / depth) * scale * 450 / aspect, y: 220 - ((x * up.x + y * up.y + z * up.z) / depth) * scale * 220 };
  });
  const polygon = projected.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const expanded = projected.map((point) => {
    const dx = point.x - 450; const dy = point.y - 220; const length = Math.hypot(dx, dy) || 1;
    return `${(point.x + dx / length * 12).toFixed(1)},${(point.y + dy / length * 12).toFixed(1)}`;
  }).join(' ');
  const clipId = `screen-${hall.id}-${seat.id}`.replace(/[^a-z0-9-]/gi, '-');
  return <div className="simplified-preview" role="img" aria-label={`Simplified preview from seat ${seat.row}${seat.number}`}>
    <svg className="simplified-preview-scene" viewBox="0 0 900 440" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="room" x2="0" y2="1"><stop stopColor="#080b0d"/><stop offset=".68" stopColor="#101617"/><stop offset="1" stopColor="#191011"/></linearGradient>
        <linearGradient id="floor" x2="0" y2="1"><stop stopColor="#181c1d"/><stop offset="1" stopColor="#050606"/></linearGradient>
        <filter id="screen-glow" x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="13"/></filter>
        <clipPath id={clipId}><polygon points={polygon}/></clipPath>
      </defs>
      <rect width="900" height="440" fill="url(#room)"/>
      <path d="M0 0H900L585 118H315Z" fill="#0b0f11" stroke="#1b2224"/>
      <path d="M0 0L315 118V335L0 408Z" fill="#111719"/><path d="M900 0L585 118V335L900 408Z" fill="#111719"/>
      <path d="M0 408L315 335H585L900 408V440H0Z" fill="url(#floor)"/>
      <path d="M30 333L330 264M870 333L570 264" stroke="#b36e47" strokeOpacity=".3" strokeWidth="3"/>
      <polygon points={expanded} fill="#10191c" stroke="#435259" strokeWidth="8"/>
      <polygon points={polygon} fill="#d89a79" opacity=".8" filter="url(#screen-glow)"/>
      <image href={poster} x="0" y="0" width="900" height="440" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`}/>
      <polygon points={polygon} fill="none" stroke="#d9e7e6" strokeOpacity=".72" strokeWidth="2"/>
      {[0, 1, 2].map((row) => <g key={row} opacity={0.72 - row * 0.1}>
        {Array.from({ length: 9 }, (_, index) => {
          const x = 188 + index * 66 + row * 10; const y = 366 + row * 22; const w = 42 + row * 5;
          return <g key={index} transform={`translate(${x} ${y})`}>
            <path d={`M0 15 Q0 0 ${w / 2} 0 Q${w} 0 ${w} 15V${23 + row * 2}H0Z`} fill="#76232b" stroke="#a33840" strokeWidth="2"/>
            <path d={`M3 ${23 + row * 2}H${w - 3}`} stroke="#d1545b" strokeWidth="4" strokeLinecap="round"/>
          </g>;
        })}
      </g>)}
    </svg>
    <div className="simplified-preview-label">Simplified preview · {seat.row}{seat.number}</div>
  </div>;
}
