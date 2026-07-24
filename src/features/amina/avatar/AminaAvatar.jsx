import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import AminaBody from './AminaBody';
import VRMAvatar from './VRMAvatar';
import styles from './AminaAvatar.module.css';

/**
 * Amina 3D Avatar Scene
 * Renders the 3D Amina character inside a Canvas with lighting and controls.
 * Supports both VRM model loading and procedural fallback.
 */

const LoadingFallback = () => (
  <mesh>
    <sphereGeometry args={[0.3, 16, 16]} />
    <meshStandardMaterial color="#20c997" wireframe />
  </mesh>
);

const Scene = ({ state, emotion, vrmUrl }) => {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 5]} intensity={1} castShadow />
      <directionalLight position={[-1, 2, 3]} intensity={0.3} color="#ffeedd" />
      <pointLight position={[0, 1, 2]} intensity={0.2} color="#20c997" />

      {/* Avatar */}
      {vrmUrl ? (
        <VRMAvatar vrmUrl={vrmUrl} state={state} emotion={emotion} />
      ) : (
        <AminaBody state={state} emotion={emotion} />
      )}

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -1.2, 0]}
        opacity={0.4}
        scale={3}
        blur={2.5}
        far={2}
      />

      {/* Controls */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.1}
        minAzimuthAngle={-Math.PI / 6}
        maxAzimuthAngle={Math.PI / 6}
        target={[0, 0.4, 0]}
      />
    </>
  );
};

export const AminaAvatar = ({ 
  state = 'idle', 
  emotion = 'neutral',
  vrmUrl = null,
  className = '',
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure canvas is mounted
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.avatarContainer} ${className}`}>
      {isReady && (
        <Canvas
          camera={{ position: [0, 0.4, 4.5], fov: 32 }}
          dpr={[1, 2]}
          gl={{ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance',
          }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={<LoadingFallback />}>
            <Scene state={state} emotion={emotion} vrmUrl={vrmUrl} />
          </Suspense>
        </Canvas>
      )}
      
      {/* State indicator */}
      <div className={styles.stateIndicator}>
        {state === 'speaking' && (
          <div className={styles.speakingDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        {state === 'listening' && (
          <div className={styles.listeningPulse} />
        )}
      </div>
    </div>
  );
};

export default AminaAvatar;
