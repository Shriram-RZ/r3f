import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Billboard, Text } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";

// Glowing Point Component
function GlowingPoint({ position, label, onPointClick, index, point }) {
  const meshRef = useRef();
  const lightRef = useRef();
  const pulseRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Manage cursor style on hover
  useEffect(() => {
    const handleCursor = () => {
      if (hovered) {
        document.body.style.cursor = "pointer";
      } else {
        document.body.style.cursor = "default";
      }
    };
    handleCursor();
    return () => {
      document.body.style.cursor = "default";
    };
  }, [hovered]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.lerp(
        new THREE.Vector3(hovered ? 1.5 : 1, hovered ? 1.5 : 1, hovered ? 1.5 : 1),
        0.1
      );
    }

    // Animated pulse ring
    if (pulseRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
      const opacity = Math.cos(state.clock.elapsedTime * 3) * 0.5 + 0.3;
      pulseRef.current.scale.set(scale, scale, scale);
      pulseRef.current.material.opacity = opacity;
    }
  });

  return (
    <group position={position}>
      {/* Glowing Sphere */}
      <mesh
        ref={meshRef}
        onClick={() => onPointClick(position, label, point)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color={hovered ? 0xffff00 : 0x00ff88} toneMapped={false} />
      </mesh>

      {/* Point Light */}
      <pointLight
        ref={lightRef}
        intensity={hovered ? 2 : 1}
        distance={5}
        color={hovered ? 0xffff00 : 0x00ff88}
      />

      {/* Outer Glow Ring */}
      <mesh>
        <torusGeometry args={[0.5, 0.05, 32, 100]} />
        <meshBasicMaterial color={hovered ? 0xffff00 : 0x00ff88} toneMapped={false} />
      </mesh>

      {/* Animated Pulse Ring */}
      <mesh ref={pulseRef}>
        <torusGeometry args={[0.5, 0.03, 32, 100]} />
        <meshBasicMaterial
          color={hovered ? 0xffff00 : 0x00ff88}
          toneMapped={false}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Label */}
      <Billboard>
        <Text position={[0, 0.8, 0]} fontSize={0.3} color={hovered ? 0xffff00 : 0x00ff88}>
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// Easing function - Slow Cubic ease in-out for cinematic feel
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Camera Controller
function CameraController({ targetPosition, targetLookAt }) {
  const { camera } = useThree();
  const animationRef = useRef({
    startPosition: null,
    startLookAt: null,
    progress: 0,
    isAnimating: false,
  });

  // Start animation only when target changes
  useEffect(() => {
    if (!targetPosition || !targetLookAt) return;

    animationRef.current.startPosition = camera.position.clone();
    animationRef.current.startLookAt = new THREE.Vector3(0, 0, 0);
    animationRef.current.progress = 0;
    animationRef.current.isAnimating = true;
  }, [targetPosition, targetLookAt, camera.position]);

  useFrame(() => {
    const animation = animationRef.current;

    if (!animation.isAnimating) {
      return;
    }

    // Update animation progress - Ultra smooth movement
    animation.progress += 0.004;

    if (animation.progress >= 1) {
      animation.progress = 1;
      animation.isAnimating = false;
      // Ensure we reach exact target
      camera.position.copy(targetPosition);
      camera.lookAt(targetLookAt);
      return;
    }

    // Apply easing with stronger curve for more pronounced ease in/out
    const eased = easeInOutCubic(animation.progress);

    // Interpolate position with easing
    camera.position.lerpVectors(animation.startPosition, targetPosition, eased);

    // Interpolate look-at point with easing
    const currentLookAt = new THREE.Vector3().lerpVectors(
      animation.startLookAt,
      targetLookAt,
      eased
    );
    camera.lookAt(currentLookAt);
  });

  return null;
}

function Model({ url, onModelLoad }) {
  const { scene } = useGLTF(url);
  const group = useRef();

  useEffect(() => {
    if (!scene) return;

    // Auto-center and scale model
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 10 / maxDim;

    scene.position.sub(center);
    scene.scale.multiplyScalar(scale);

    // Enable shadows
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (onModelLoad) {
      onModelLoad(scene);
    }
  }, [scene, onModelLoad]);

  return <primitive object={scene} ref={group} />;
}

function Background() {
  return null;
}

export default function App() {
  const [cameraTarget, setCameraTarget] = useState(null);
  const [cameraLookAt, setCameraLookAt] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [glowingPoints, setGlowingPoints] = useState([
    {
      position: [2, 3, -2],
      label: "Point A",
      content: {
        title: "Master Bedroom",
        description: "Spacious master bedroom with premium furnishings and natural lighting.",
        specs: ["3.5m x 4.2m", "King bed", "Ensuite bathroom"],
      },
    },
    {
      position: [-3, 2, 1],
      label: "Point B",
      content: {
        title: "Living Room",
        description: "Modern living area with comfortable seating and entertainment setup.",
        specs: ["5m x 6m", "Premium sofa", '65" Smart TV'],
      },
    },
    {
      position: [1, -1, 3],
      label: "Point C",
      content: {
        title: "Kitchen",
        description: "Contemporary kitchen with modern appliances and ample storage.",
        specs: ["3m x 4m", "Stainless steel appliances", "Granite counters"],
      },
    },
    {
      position: [-2, 0, -3],
      label: "Point D",
      content: {
        title: "Bathroom",
        description: "Luxurious bathroom with spa-like amenities.",
        specs: ["2.5m x 3m", "Jacuzzi tub", "Rainfall shower"],
      },
    },
  ]);

  const handlePointClick = (position, label, point) => {
    // Set the selected point to show dropdown
    setSelectedPoint({ position, label, point });

    // Calculate camera position at a distance from the point
    const direction = new THREE.Vector3(position[0], position[1], position[2]).normalize();
    const cameraPos = new THREE.Vector3(
      position[0] + direction.x * 5,
      position[1] + direction.y * 5,
      position[2] + direction.z * 5
    );

    setCameraTarget(cameraPos);
    setCameraLookAt(new THREE.Vector3(position[0], position[1], position[2]));
  };

  const handleResetCamera = () => {
    setCameraTarget(new THREE.Vector3(15, 12, 15));
    setCameraLookAt(new THREE.Vector3(0, 0, 0));
    setSelectedPoint(null);
  };

  const buttonSize = isMobile ? "10px 16px" : "12px 24px";
  const fontSize = isMobile ? "12px" : "14px";
  const panelMaxWidth = isMobile ? "90vw" : "400px";
  const panelPadding = isMobile ? "16px" : "24px";

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* Background GIF */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: "url('./peach.gif')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
          zIndex: 1,
          opacity: 0.4,
        }}
      />

      {/* 3D Canvas */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
        <Canvas
          shadows
          camera={{ position: [15, 12, 15], fov: 50 }}
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={[0x0a0e27]} />
          {/* Cinematic Lighting Setup */}
          <directionalLight
            position={[8, 10, 6]}
            intensity={0.9}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={100}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
            shadow-bias={-0.0001}
          />

          <directionalLight position={[-8, 6, 8]} intensity={0.4} color={0xb0c4ff} />

          <directionalLight position={[0, 8, -10]} intensity={0.3} color={0xffd4a3} />

          <ambientLight intensity={0.35} color={0xffffff} />

          <pointLight position={[5, 5, 5]} intensity={0.2} color={0xffffff} />

          <Background />

          <Model url="/model/no_model.glb" />

          {glowingPoints.map((point, index) => (
            <GlowingPoint
              key={index}
              position={point.position}
              label={point.label}
              onPointClick={handlePointClick}
              index={index}
              point={point}
            />
          ))}

          <CameraController targetPosition={cameraTarget} targetLookAt={cameraLookAt} />

          <OrbitControls
            enabled={false}
            autoRotate={false}
            enableDamping={false}
            enableZoom={false}
            enablePan={false}
          />
        </Canvas>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleResetCamera}
        style={{
          position: "fixed",
          top: isMobile ? "10px" : "20px",
          right: isMobile ? "10px" : "20px",
          zIndex: 102,
          padding: buttonSize,
          backgroundColor: "#00ff88",
          color: "#0a0e27",
          border: "none",
          borderRadius: "8px",
          fontSize: fontSize,
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 0 20px rgba(0, 255, 136, 0.5)",
          transition: "all 0.3s ease",
          touchAction: "manipulation",
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = "#ffff00";
          e.target.style.boxShadow = "0 0 30px rgba(255, 255, 0, 0.7)";
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = "#00ff88";
          e.target.style.boxShadow = "0 0 20px rgba(0, 255, 136, 0.5)";
        }}
      >
        {isMobile ? "Reset" : "Reset Camera"}
      </button>

      {/* Dropdown Content Panel */}
      {selectedPoint && (
        <div
          style={{
            position: "fixed",
            bottom: isMobile ? "10px" : "30px",
            left: isMobile ? "10px" : "30px",
            right: isMobile ? "10px" : "auto",
            zIndex: 103,
            backgroundColor: "rgba(10, 14, 39, 0.95)",
            border: "2px solid #00ff88",
            borderRadius: "12px",
            padding: panelPadding,
            minWidth: isMobile ? "auto" : "320px",
            maxWidth: panelMaxWidth,
            boxShadow: "0 0 30px rgba(0, 255, 136, 0.3)",
            backdropFilter: "blur(10px)",
            animation: "slideUp 0.4s ease-out",
            maxHeight: isMobile ? "60vh" : "auto",
            overflowY: isMobile ? "auto" : "visible",
          }}
        >
          <style>{`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
            <h2 style={{ color: "#00ff88", margin: 0, fontSize: isMobile ? "16px" : "20px" }}>
              {selectedPoint.point.content.title}
            </h2>
            <button
              onClick={() => setSelectedPoint(null)}
              style={{
                background: "none",
                border: "none",
                color: "#00ff88",
                fontSize: isMobile ? "20px" : "24px",
                cursor: "pointer",
                padding: 0,
                width: "24px",
                height: "24px",
              }}
            >
              ✕
            </button>
          </div>

          <p style={{ color: "#b0c4ff", margin: "12px 0", fontSize: isMobile ? "12px" : "14px", lineHeight: "1.5" }}>
            {selectedPoint.point.content.description}
          </p>

          <div style={{ margin: "16px 0" }}>
            <h3 style={{ color: "#ffd4a3", fontSize: isMobile ? "10px" : "12px", textTransform: "uppercase", marginBottom: "8px" }}>
              Specifications
            </h3>
            <ul style={{ margin: 0, paddingLeft: "16px" }}>
              {selectedPoint.point.content.specs.map((spec, idx) => (
                <li key={idx} style={{ color: "#ffffff", fontSize: isMobile ? "11px" : "13px", marginBottom: "4px" }}>
                  {spec}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setSelectedPoint(null)}
            style={{
              width: "100%",
              marginTop: "16px",
              padding: isMobile ? "8px 12px" : "10px 16px",
              backgroundColor: "#00ff88",
              color: "#0a0e27",
              border: "none",
              borderRadius: "6px",
              fontSize: isMobile ? "11px" : "12px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "all 0.3s ease",
              touchAction: "manipulation",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#ffff00";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#00ff88";
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}