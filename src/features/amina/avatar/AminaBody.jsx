import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Procedural Amina Avatar — Full-Body African Female Healthcare Worker
 * Built with Three.js primitives as a fallback when no VRM model is loaded.
 * Supports idle, speaking, and listening animation states.
 */

const SKIN_COLOR = '#8B6914';
const UNIFORM_COLOR = '#20c997';
const HAIR_COLOR = '#1a1a2e';
const EYE_WHITE = '#ffffff';
const EYE_IRIS = '#3d2b1f';
const LIP_COLOR = '#c0392b';
const SHOE_COLOR = '#1a1a2e';
const SKIRT_COLOR = '#12b886';

export function AminaBody({ state = 'idle', emotion = 'neutral' }) {
  const groupRef = useRef();
  const mouthRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const headRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();

  // Idle animation — breathing, blinking, speaking, listening
  useFrame((clock) => {
    const t = clock.clock.elapsedTime;

    if (groupRef.current) {
      // Breathing
      groupRef.current.position.y = Math.sin(t * 1.5) * 0.02;
      // Subtle sway
      groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.01;
    }

    if (headRef.current) {
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
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.6, 0.05);
        mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, 1.1, 0.05);
      } else {
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.3, 0.05);
        mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, 1, 0.05);
      }
    }

    // Head nod for listening
    if (headRef.current && state === 'listening') {
      headRef.current.rotation.x = Math.sin(t * 2) * 0.08;
    }

    // Arm sway for idle
    if (leftArmRef.current && rightArmRef.current) {
      if (state === 'idle') {
        leftArmRef.current.rotation.x = Math.sin(t * 0.8) * 0.05;
        rightArmRef.current.rotation.x = Math.sin(t * 0.8 + Math.PI) * 0.05;
      } else if (state === 'speaking') {
        // Subtle gesture while speaking
        leftArmRef.current.rotation.x = Math.sin(t * 1.5) * 0.1;
        rightArmRef.current.rotation.x = Math.sin(t * 1.5 + 1) * 0.12;
      } else {
        leftArmRef.current.rotation.x = 0;
        rightArmRef.current.rotation.x = 0;
      }
    }
  });

  const mouthColor = emotion === 'happy' ? '#e74c3c' : emotion === 'concerned' ? '#c0392b' : LIP_COLOR;

  return (
    <group ref={groupRef}>
      {/* ============================================================
          HEAD
          ============================================================ */}
      <group ref={headRef} position={[0, 1.25, 0]}>
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

        {/* Smile lines for happy */}
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

      {/* ============================================================
          NECK
          ============================================================ */}
      <mesh position={[0, 0.92, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.18, 16]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
      </mesh>

      {/* ============================================================
          TORSO
          ============================================================ */}
      <group position={[0, 0.35, 0]}>
        {/* Upper torso */}
        <mesh position={[0, 0.25, 0]}>
          <capsuleGeometry args={[0.28, 0.35, 8, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>

        {/* Lower torso / waist */}
        <mesh position={[0, -0.1, 0]}>
          <capsuleGeometry args={[0.26, 0.2, 8, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>

        {/* Collar / V-neck */}
        <mesh position={[0, 0.48, 0.1]}>
          <boxGeometry args={[0.2, 0.06, 0.12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>

        {/* Shoulders */}
        <mesh position={[-0.35, 0.38, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>
        <mesh position={[0.35, 0.38, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>

        {/* Stethoscope */}
        <mesh position={[0, 0.3, 0.28]}>
          <torusGeometry args={[0.07, 0.012, 8, 16]} />
          <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Stethoscope tube */}
        <mesh position={[0, 0.15, 0.26]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.2, 8]} />
          <meshStandardMaterial color="#555555" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* ============================================================
          ARMS
          ============================================================ */}
      {/* Left arm */}
      <group ref={leftArmRef} position={[-0.42, 0.65, 0]}>
        {/* Upper arm (in uniform) */}
        <mesh position={[0, -0.15, 0]} rotation={[0, 0, 0.08]}>
          <capsuleGeometry args={[0.065, 0.25, 8, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>
        {/* Elbow */}
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Forearm (skin) */}
        <mesh position={[0, -0.5, 0]} rotation={[0, 0, 0.05]}>
          <capsuleGeometry args={[0.05, 0.25, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.7, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={rightArmRef} position={[0.42, 0.65, 0]}>
        {/* Upper arm (in uniform) */}
        <mesh position={[0, -0.15, 0]} rotation={[0, 0, -0.08]}>
          <capsuleGeometry args={[0.065, 0.25, 8, 16]} />
          <meshStandardMaterial color={UNIFORM_COLOR} roughness={0.7} />
        </mesh>
        {/* Elbow */}
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Forearm (skin) */}
        <mesh position={[0, -0.5, 0]} rotation={[0, 0, -0.05]}>
          <capsuleGeometry args={[0.05, 0.25, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Hand */}
        <mesh position={[0, -0.7, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
      </group>

      {/* ============================================================
          SKIRT / LOWER BODY
          ============================================================ */}
      <group position={[0, -0.35, 0]}>
        {/* Skirt upper */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.26, 0.32, 0.3, 16]} />
          <meshStandardMaterial color={SKIRT_COLOR} roughness={0.7} />
        </mesh>
        {/* Skirt lower — flared */}
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.32, 0.38, 0.2, 16]} />
          <meshStandardMaterial color={SKIRT_COLOR} roughness={0.7} />
        </mesh>
      </group>

      {/* ============================================================
          LEGS
          ============================================================ */}
      {/* Left leg */}
      <group position={[-0.12, -0.65, 0]}>
        {/* Thigh (skin visible below skirt) */}
        <mesh position={[0, 0.1, 0]}>
          <capsuleGeometry args={[0.07, 0.2, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Knee */}
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Lower leg / calf */}
        <mesh position={[0, -0.28, 0]}>
          <capsuleGeometry args={[0.055, 0.28, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Ankle */}
        <mesh position={[0, -0.46, 0]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.52, 0.03]} scale={[1, 0.5, 1.4]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={SHOE_COLOR} roughness={0.6} />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[0.12, -0.65, 0]}>
        {/* Thigh */}
        <mesh position={[0, 0.1, 0]}>
          <capsuleGeometry args={[0.07, 0.2, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Knee */}
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Lower leg / calf */}
        <mesh position={[0, -0.28, 0]}>
          <capsuleGeometry args={[0.055, 0.28, 8, 16]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Ankle */}
        <mesh position={[0, -0.46, 0]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
        </mesh>
        {/* Shoe */}
        <mesh position={[0, -0.52, 0.03]} scale={[1, 0.5, 1.4]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={SHOE_COLOR} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

export default AminaBody;
