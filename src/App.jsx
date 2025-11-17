import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

function CameraController({ targetPosition }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!targetPosition) return;
    camera.position.lerp(targetPosition, 0.05);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function ClickPoint({ position, onClick }) {
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick(position);
      }}
    >
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}

function CubeWithPoints({ onPointClick }) {
  const size = 3;
  const half = size / 2;

  const points = [
    [half, half, half],
    [-half, half, half],
    [half, -half, half],
    [-half, -half, half],
    [half, half, -half],
    [-half, half, -half],
  ];

  return (
    <group>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {points.map((pos, i) => (
        <ClickPoint key={i} position={pos} onClick={onPointClick} />
      ))}
    </group>
  );
}

export default function App() {
  const [target, setTarget] = useState(null);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [6, 6, 6], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} />

        <OrbitControls enablePan={false} />

        <CameraController targetPosition={target} />

        <CubeWithPoints
          onPointClick={(point) =>
            setTarget(
              new THREE.Vector3(point[0] * 1.8, point[1] * 1.8, point[2] * 1.8)
            )
          }
        />
      </Canvas>
    </div>
  );
}
