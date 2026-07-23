import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Procedural Amina Avatar — African Female Healthcare Worker
 * Built with Three.js primitives as a fallback when no VRM model is loaded.
 * Supports idle, speaking, and listening animation states.
 */

const SKIN_COLOR = '#8B6914';
const UNIFORM_COLOR = '#20c997';
const HAIR_COLOR = '#1a1a2e';
const EYE_WHITE = '#ffffff';
const EYE_IRIS = '#3d2b1f';
const LIP_COLOR = '#c0392b';

export function AminaBody({ state = 'idle', emotion = 'neutral' }) {
  const groupRef = useRef();
  const mouthRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const headRef = useRef();

  // Idle animation — breathing
  useFrame((clock) => {
    const t = clock.clock.elapsedTime;

    if (groupRef.current) {
      // Breathing
      groupRef.current.position.y = Math.sin(t * 1.5) * 0.02;
      // Subtle sway
      groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.01;
    }

    if (headRef.current) {
      // Head subtle movement
      headRef.current.rotation.x = Math.sin(t * 0.7) * 0.03;
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.02;
    }

    // Blinking
    if (leftEyeRef.current && rightEyeRef.current) {
      const blinkCycle = Math.sin(t * 0.3) > 0.98;
      const scaleY = blinkCycle ? 0.1 : 1;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, scaleY, 0.3);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, scaleY, 0.3);
    }

    // Speaking mouth animation
    if (mouthRef.current) {
      if (state === 'speaking') {
        mouthRef.current.scale.y = 0.8 + Math.sin(t * 12) * 0.5 + Math.sin(t * 7) * 0.3;
        mouthRef.current.scale.x = 1 + Math.sin(t * 9) * 0.15;
      } else if (state === 'listening') {
        // Slight open mouth when listening
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.6, 0.05);
        mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, 1.1, 0.05);
      } else {
        // Idle — closed mouth
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.3, 0.05);
        mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, 1, 0.05);
      }
    }

    // Head nod for listening
    if (headRef.current && state === 'listening') {
      headRef.current.rotation.x = Math.sin(t * 2) * 0.08;
    }
  });

  // Emotion-based colors
  const mouthColor = emotion === 'happy' ? '#e74c3c' : emotion === 'concerned' ? '#c0392b' : LIP_COLOR;

  return (
    <group ref={groupRef}>
      {/* === BODY === */}
      <group position={[0, -0.8, 0]}>
        {/* Torso */}
        <mesh position={[0, 0.4, 0]}>
          <capsuleGeometry args={[0.35, 0.5, 8, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>
        {/* Collar */}
        <mesh position={[0, 0.72, 0.12]}>
          <boxGeometry args={[0.25, 0.08, 0.15]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
        {/* Shoulders */}
        <mesh position={[-0.4, 0.6, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>
        <mesh position={[0.4, 0.6, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.45, 0.2, 0]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.08, 0.4, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        <mesh position={[0.45, 0.2, 0]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.08, 0.4, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Stethoscope */}
        <mesh position={[0, 0.5, 0.3]}>
          <torusGeometry args={[0.08, 0.015, 8, 16]} />
          <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* === NECK === */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.15, 16]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
      </mesh>

      {/* === HEAD === */}
      <group ref={headRef} position={[0, 0.15, 0]}>
        {/* Skull */}
        <mesh>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>

        {/* Hair — afro style */}
        <mesh position={[0, 0.12, -0.02]} scale={[1.15, 1.2, 1.1]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={HAIR_COLOR} roughness={0.9} />
        </mesh>
        {/* Hair bun */}
        <mesh position={[0, 0.3, -0.15]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={HAIR_COLOR} roughness={0.9} />
        </mesh>

        {/* Face */}
        {/* Eyes */}
        <group position={[-0.1, 0.05, 0.28]}>
          <mesh ref={leftEyeRef}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial color={EYE_WHITE} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial color={EYE_IRIS} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
        <group position={[0.1, 0.05, 0.28]}>
          <mesh ref={rightEyeRef}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshStandardMaterial color={EYE_WHITE} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <sphereGeometry args={[0.025, 16, 16]} />
            <meshStandardMaterial color={EYE_IRIS} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>

        {/* Eyebrows */}
        <mesh position={[-0.1, 0.12, 0.3]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.08, 0.015, 0.02]} />
          <meshStandardMaterial color={HAIR_COLOR} />
        </mesh>
        <mesh position={[0.1, 0.12, 0.3]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.08, 0.015, 0.02]} />
          <meshStandardMaterial color={HAIR_COLOR} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.32]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>

        {/* Mouth */}
        <group ref={mouthRef} position={[0, -0.1, 0.3]}>
          <mesh>
            <boxGeometry args={[0.07, 0.025, 0.01]} />
            <meshStandardMaterial color={mouthColor} roughness={0.6} />
          </mesh>
        </group>

        {/* Smile lines for happy emotion */}
        {emotion === 'happy' && (
          <>
            <mesh position={[-0.12, -0.05, 0.28]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.04, 0.008, 0.005]} />
              <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
            </mesh>
            <mesh position={[0.12, -0.05, 0.28]} rotation={[0, 0, -0.3]}>
              <boxGeometry args={[0.04, 0.008, 0.005]} />
              <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
            </mesh>
          </>
        )}

        {/* Headscarf / cap */}
        <mesh position={[0, 0.2, 0.05]} scale={[1.05, 0.6, 1.05]}>
          <sphereGeometry args={[0.3, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export default AminaBody;
