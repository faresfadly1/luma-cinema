import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Hall, Seat } from './geometry';
import { eyePoint } from './geometry';

export function CinemaPreview({ hall, seat, poster, forceFallback = false }: { hall: Hall; seat: Seat; poster: string; forceFallback?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [reset, setReset] = useState(0);

  useEffect(() => {
    if (forceFallback || failed) return;
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { setFailed(true); return; }

    setFailed(false);
    const maxSeatZ = Math.max(...hall.rows.map((row) => row.z));
    const maxSeatX = Math.max(...hall.rows.flatMap((row) => row.xPositions.map(Math.abs)));
    const roomWidth = maxSeatX * 2 + 4;
    const roomDepth = maxSeatZ + 8;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080b0c');
    scene.fog = new THREE.Fog('#080b0c', 26, roomDepth + 13);
    const width = element.clientWidth || 900;
    const height = element.clientHeight || 480;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    element.replaceChildren(renderer.domElement);

    const eye = eyePoint(seat);
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 110);
    camera.position.set(eye.x, eye.y, eye.z);
    const screenCenter = new THREE.Vector3(hall.screen.center.x, hall.screen.center.y, hall.screen.center.z);
    camera.lookAt(screenCenter);

    scene.add(new THREE.HemisphereLight(0xb9c6d0, 0x16100f, 1.0));
    scene.add(new THREE.AmbientLight(0x887b79, 0.48));
    const aisleGlow = new THREE.PointLight(0xffa568, 14, 24, 2);
    aisleGlow.position.set(0, 0.4, Math.min(maxSeatZ, 12));
    scene.add(aisleGlow);
    const ceilingLight = new THREE.PointLight(0x887b75, 10, roomDepth + 10, 2);
    ceilingLight.position.set(0, 5.7, maxSeatZ * 0.56);
    scene.add(ceilingLight);
    const screenGlow = new THREE.PointLight(0xcde4ef, 18, 18, 2);
    screenGlow.position.set(hall.screen.center.x, hall.screen.center.y, hall.screen.center.z + 0.65);
    scene.add(screenGlow);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111516, roughness: 0.96, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.12, roomDepth / 2 - 2);
    floor.receiveShadow = true;
    scene.add(floor);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x121618, roughness: 0.92, metalness: 0.08 });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.1, roomDepth), wallMaterial);
      wall.position.set(side * roomWidth / 2, 3.0, roomDepth / 2 - 2);
      wall.receiveShadow = true;
      scene.add(wall);
      const wallRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, roomDepth * 0.88), new THREE.MeshStandardMaterial({ color: 0x3d2722, emissive: 0x482114, emissiveIntensity: 0.6 }));
      wallRail.position.set(side * (roomWidth / 2 - 0.16), 0.54, roomDepth / 2 - 2);
      scene.add(wallRail);
    }
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), new THREE.MeshStandardMaterial({ color: 0x101315, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 6.2, roomDepth / 2 - 2);
    scene.add(ceiling);

    const screenWidth = hall.screen.width;
    const screenHeight = hall.screen.height;
    const screen = new THREE.Group();
    screen.position.set(hall.screen.center.x, hall.screen.center.y, hall.screen.center.z);
    screen.rotation.y = THREE.MathUtils.degToRad(hall.screen.yawDegrees);
    scene.add(screen);
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 700;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#131c20';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#172831');
      gradient.addColorStop(1, '#d38f6c');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screenWidth, screenHeight), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
    screenMesh.position.z = -0.08;
    screen.add(screenMesh);
    const screenFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x29383b, emissive: 0x101c20, roughness: 0.46, metalness: 0.28 });
    const frame = new THREE.Mesh(new RoundedBoxGeometry(screenWidth + 0.35, screenHeight + 0.28, 0.13, 2, 0.08), screenFrameMaterial);
    frame.position.z = -0.18;
    screen.add(frame);
    const image = new Image();
    image.onload = () => {
      if (!context) return;
      const imageRatio = image.width / image.height;
      const frameRatio = canvas.width / canvas.height;
      let sx = 0; let sy = 0; let sw = image.width; let sh = image.height;
      if (imageRatio > frameRatio) { sw = image.height * frameRatio; sx = (image.width - sw) / 2; }
      else { sh = image.width / frameRatio; sy = (image.height - sh) / 2; }
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
      renderer.render(scene, camera);
    };
    image.src = poster;

    const velvet = new THREE.MeshPhysicalMaterial({ color: 0x842029, roughness: 0.84, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.82 });
    const cushionMaterial = new THREE.MeshPhysicalMaterial({ color: 0xa52e37, roughness: 0.78, metalness: 0, clearcoat: 0.08 });
    const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x4e151b, roughness: 0.9 });
    const chairMetal = new THREE.MeshStandardMaterial({ color: 0x343536, roughness: 0.58, metalness: 0.48 });
    for (const row of hall.rows) {
      for (const x of row.xPositions) {
        const chair = new THREE.Group();
        chair.position.set(x, row.y, row.z);
        const back = new THREE.Mesh(new RoundedBoxGeometry(0.49, 0.75, 0.19, 4, 0.12), velvet);
        back.position.set(0, 0.72, 0.18);
        back.castShadow = true;
        back.receiveShadow = true;
        chair.add(back);
        const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.18, 0.52, 4, 0.08), cushionMaterial);
        cushion.position.set(0, 0.34, -0.06);
        cushion.castShadow = true;
        chair.add(cushion);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.22, 0.55, 3, 0.035), velvet);
          arm.position.set(side * 0.29, 0.47, 0.02);
          arm.castShadow = true;
          chair.add(arm);
          const support = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.27, 8), chairMetal);
          support.position.set(side * 0.29, 0.19, 0.02);
          chair.add(support);
        }
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.22, 10), chairMetal);
        pedestal.position.set(0, 0.12, 0.08);
        chair.add(pedestal);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.49, 0.012), seamMaterial);
        seam.position.set(0, 0.73, 0.282);
        chair.add(seam);
        scene.add(chair);
      }
      const leftEdge = Math.max(...row.xPositions.filter((x) => x < 0));
      const rightEdge = Math.min(...row.xPositions.filter((x) => x > 0));
      const aisleCenter = (leftEdge + rightEdge) / 2;
      for (const side of [-1, 1]) {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffbd85, emissive: 0xff8d4c, emissiveIntensity: 1.5, roughness: 0.5 }));
        marker.position.set(aisleCenter + side * 0.36, 0.09, row.z + 0.18);
        scene.add(marker);
      }
    }

    const selectedMarker = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 6, 24), new THREE.MeshBasicMaterial({ color: 0xa3ecc5 }));
    selectedMarker.rotation.x = Math.PI / 2;
    selectedMarker.position.set(seat.position.x, 0.08, seat.position.z);
    scene.add(selectedMarker);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const pointerDown = (event: PointerEvent) => { dragging = true; lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture(event.pointerId); };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX; const dy = event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
      const direction = new THREE.Vector3().subVectors(screenCenter, camera.position).normalize();
      const spherical = new THREE.Spherical().setFromVector3(direction);
      spherical.theta -= dx * 0.003;
      spherical.phi = Math.max(0.52, Math.min(2.25, spherical.phi + dy * 0.003));
      const maxYaw = THREE.MathUtils.degToRad(35);
      spherical.theta = Math.max(-maxYaw, Math.min(maxYaw, spherical.theta));
      const next = new THREE.Vector3().setFromSpherical(spherical).multiplyScalar(10).add(camera.position);
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
    const onContextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.render(scene, camera);

    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointercancel', pointerUp);
      renderer.dispose();
      texture.dispose();
      image.onload = null;
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
          else mesh.material.dispose();
        }
      });
    };
  }, [hall, seat, poster, reset, failed, forceFallback]);

  if (failed || forceFallback) return <PerspectiveFallback hall={hall} seat={seat} poster={poster}/>;
  return <div className="cinema-preview-shell"><div className="preview-canvas" ref={host} role="img" aria-label={`Cinema screen view from seat ${seat.row}${seat.number}`}/><div className="preview-controls"><span>VIEW FROM {seat.row}{seat.number} · Drag to look around</span><button onClick={() => setReset((value) => value + 1)}>Reset view</button></div></div>;
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
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };
  const fov = 58 * Math.PI / 180;
  const aspect = 900 / 440;
  const scale = 1 / Math.tan(fov / 2);
  const projected = points3d.map((point) => {
    const x = point.x - eye.x; const y = point.y - eye.y; const z = point.z - eye.z;
    const depth = x * forward.x + y * forward.y + z * forward.z;
    const cameraX = x * right.x + y * right.y + z * right.z;
    const cameraY = x * up.x + y * up.y + z * up.z;
    const safeDepth = Math.max(0.1, depth);
    return { x: 450 + (cameraX / safeDepth) * scale * 450 / aspect, y: 220 - (cameraY / safeDepth) * scale * 440 / 2 };
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
      <path d="M0 0L315 118V335L0 408Z" fill="#111719"/>
      <path d="M900 0L585 118V335L900 408Z" fill="#111719"/>
      <path d="M0 408L315 335H585L900 408V440H0Z" fill="url(#floor)"/>
      <path d="M30 333L330 264M870 333L570 264" stroke="#b36e47" strokeOpacity=".3" strokeWidth="3"/>
      <polygon points={expanded} fill="#10191c" stroke="#435259" strokeWidth="8"/>
      <polygon points={polygon} fill="#d89a79" opacity=".8" filter="url(#screen-glow)"/>
      <image href={poster} x="0" y="0" width="900" height="440" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`}/>
      <polygon points={polygon} fill="none" stroke="#d9e7e6" strokeOpacity=".72" strokeWidth="2"/>
      {[0, 1, 2].map((row) => <g key={row} opacity={0.72 - row * 0.1}>
        {Array.from({ length: 9 }, (_, index) => {
          const x = 188 + index * 66 + row * 10;
          const y = 366 + row * 22;
          const w = 42 + row * 5;
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
