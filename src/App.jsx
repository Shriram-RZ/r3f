import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Billboard, Text, Html } from "@react-three/drei";
import * as THREE from "three";

/*
  Ultra-smooth mobile-optimized single-file React component.
  - Option A chosen: remove heavy effects (no pulse ring), low shadow cost, antialias off on mobile,
    clamp pixel ratio, cache GLTF, simplified geometries/materials.
  - Put your model at /public/model.glb (or update MODEL_URL below).
*/

const MODEL_URL = "/model/no_model.glb"; // <-- put real glb here (public/model.glb)

// Utility: detect low-end / mobile
function useDevicePerformance() {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 768);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener("resize", onResize);
    // heuristic for low power devices
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    setLowPower(dpr < 1 || dpr >= 2.5 || navigator.hardwareConcurrency <= 2);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return { isMobile, lowPower };
}

// Simple, performant glowing point (no heavy dynamic rings)
function GlowingPoint({ position, label, onPointClick }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!ref.current) return;
    // Subtle breathing scale on desktop only
    const t = performance.now() / 1000;
    const scale = hovered ? 1.4 : 1 + Math.sin(t * 1.2) * 0.02;
    ref.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.08);
  });

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onPointClick && onPointClick(position);
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        castShadow={false}
        receiveShadow={false}
      >
        {/* Lower-poly sphere for mobile */}
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshBasicMaterial toneMapped={false} color={hovered ? "#ffff66" : "#00ff88"} />
      </mesh>

      <Billboard position={[0, 0.8, 0]} follow={true}>
        <Text fontSize={0.28} color={hovered ? "#ffff66" : "#00ff88"} anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// Camera controller with very lightweight easing
function CameraController({ targetPos, targetLookAt }) {
  const { camera } = useThree();
  const ref = useRef({ progress: 1, fromPos: new THREE.Vector3(), fromLookAt: new THREE.Vector3() });

  useEffect(() => {
    if (!targetPos || !targetLookAt) return;
    ref.current.progress = 0;
    ref.current.fromPos = camera.position.clone();
    ref.current.fromLookAt = new THREE.Vector3();
  }, [targetPos, targetLookAt, camera.position]);

  useFrame(() => {
    const r = ref.current;
    if (r.progress >= 1 || !targetPos || !targetLookAt) return;
    // fast but smooth easing
    r.progress = Math.min(1, r.progress + 0.03); // faster than before for snappier feel on mobile
    const eased = (1 - Math.cos(r.progress * Math.PI)) / 2;

    camera.position.lerpVectors(r.fromPos, targetPos, eased);
    const lookAt = new THREE.Vector3().lerpVectors(r.fromLookAt, targetLookAt, eased);
    camera.lookAt(lookAt);
  });

  return null;
}

// Cached GLTF loader wrapper
function Model({ url, onModelLoad, castShadow = false, receiveShadow = false }) {
  // useGLTF caches internally; calling useMemo helps prevent re-processing
  const gltf = useGLTF(url, true);
  const sceneRef = useRef();

  useEffect(() => {
    if (!gltf || !gltf.scene) return;
    const scene = gltf.scene;

    // Auto-center + scale down gently but cheaply
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 6 / maxDim : 1; // smaller scale than before
    scene.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center.multiplyScalar(scale));

    // Low-cost shadow flagging (no heavy material updates)
    scene.traverse((ch) => {
      if (ch.isMesh) {
        ch.castShadow = castShadow;
        ch.receiveShadow = receiveShadow;
        // avoid expensive material updates
        if (ch.material && ch.material.isMeshStandardMaterial) {
          ch.material.roughness = Math.min(1, ch.material.roughness || 1);
        }
      }
    });

    onModelLoad && onModelLoad(scene);
  }, [gltf, onModelLoad, castShadow, receiveShadow]);

  return gltf ? <primitive ref={sceneRef} object={gltf.scene} /> : null;
}

export default function App() {
  const { isMobile, lowPower } = useDevicePerformance();

  // camera targets
  const [cameraTarget, setCameraTarget] = useState(null);
  const [cameraLookAt, setCameraLookAt] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Points (memoized)
  const glowingPoints = useMemo(
    () => [
      { position: [2, 3, -2], label: "Point A", content: { title: "Master Bedroom", description: "Spacious master bedroom...", specs: ["3.5m x 4.2m", "King bed"] } },
      { position: [-3, 2, 1], label: "Point B", content: { title: "Living Room", description: "Modern living area...", specs: ["5m x 6m", "Premium sofa"] } },
      { position: [1, -1, 3], label: "Point C", content: { title: "Kitchen", description: "Contemporary kitchen...", specs: ["3m x 4m"] } },
      { position: [-2, 0, -3], label: "Point D", content: { title: "Bathroom", description: "Luxurious bathroom...", specs: ["2.5m x 3m"] } },
    ],
    []
  );

  // Handler
  const handlePointClick = (pos, idx) => {
    setSelectedIndex(idx);
    const dir = new THREE.Vector3(pos[0], pos[1], pos[2]).normalize();
    const camPos = new THREE.Vector3(pos[0] + dir.x * 4.2, pos[1] + dir.y * 4.2, pos[2] + dir.z * 4.2);
    setCameraTarget(camPos);
    setCameraLookAt(new THREE.Vector3(pos[0], pos[1], pos[2]));
  };

  const resetCamera = () => {
    setCameraTarget(new THREE.Vector3(14, 10, 14));
    setCameraLookAt(new THREE.Vector3(0, 0, 0));
    setSelectedIndex(null);
  };

  // Canvas pixel ratio clamp and shadow quality based on device
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const useAntialias = !isMobile && !lowPower;
  const shadows = !isMobile && !lowPower; // desktop only for Option A

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, background: "url('./peach.gif') center/cover no-repeat", opacity: 0.38, zIndex: 1 }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
        <Canvas
          shadows={shadows}
          gl={{ antialias: useAntialias, powerPreference: "high-performance" }}
          camera={{ position: [14, 10, 14], fov: 50 }}
          style={{ width: "100%", height: "100%" }}
          dpr={isMobile || lowPower ? 1 : dpr}
        >
          {/* cheap background color */}
          <color attach="background" args={[0x0a0e27]} />

          {/* Lighting - very lightweight */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow={shadows} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
          <directionalLight position={[-5, 6, -4]} intensity={0.25} />

          <Suspense fallback={<Html center style={{ color: "#fff" }}>Loading 3D...</Html>}>
            <Model url={MODEL_URL} castShadow={false} receiveShadow={false} onModelLoad={() => { }} />
          </Suspense>

          {/* Points */}
          {glowingPoints.map((p, i) => (
            <GlowingPoint key={i} position={p.position} label={p.label} onPointClick={() => handlePointClick(p.position, i)} />
          ))}

          {/* Lightweight camera controller */}
          <CameraController targetPos={cameraTarget} targetLookAt={cameraLookAt} />

          {/* OrbitControls kept disabled but ready if needed */}
          <OrbitControls enabled={false} />
        </Canvas>
      </div>

      {/* Simple UI controls */}
      <button
        onClick={resetCamera}
        style={{
          position: "fixed",
          top: isMobile ? 10 : 20,
          right: isMobile ? 10 : 20,
          zIndex: 100,
          padding: isMobile ? "8px 12px" : "10px 16px",
          background: "#00ff88",
          color: "#0a0e27",
          border: "none",
          borderRadius: 8,
          fontWeight: "700",
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0,255,136,0.18)",
          touchAction: "manipulation",
        }}
      >
        {isMobile ? "Reset" : "Reset Camera"}
      </button>

      {/* Info panel (minimal) */}
      {selectedIndex !== null && (
        <div
          style={{
            position: "fixed",
            bottom: isMobile ? 12 : 28,
            left: isMobile ? 12 : 28,
            right: isMobile ? 12 : "auto",
            zIndex: 101,
            background: "rgba(10,14,39,0.95)",
            border: "1px solid #00ff88",
            borderRadius: 10,
            padding: isMobile ? 12 : 18,
            maxWidth: isMobile ? "auto" : 380,
            color: "#dfefff",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#00ff88" }}>{glowingPoints[selectedIndex].content.title}</strong>
            <button onClick={() => setSelectedIndex(null)} style={{ background: "none", border: "none", color: "#00ff88", fontSize: 18 }}>✕</button>
          </div>
          <p style={{ marginTop: 8, marginBottom: 8, fontSize: 13 }}>{glowingPoints[selectedIndex].content.description}</p>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {glowingPoints[selectedIndex].content.specs.map((s, idx) => (
              <li key={idx} style={{ fontSize: 13 }}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// NOTE: run `npm install three @react-three/fiber @react-three/drei` and put a glb file at public/model/model.glb
// If you previously had /model/no_model.glb causing 404, move/rename your model to /public/model/model.glb and update MODEL_URL above.
