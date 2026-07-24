import { Suspense, useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import AminaBody from './AminaBody';
import VRMAvatar from './VRMAvatar';
import styles from './AminaAvatar.module.css';

const LoadingFallback = () => (
  <mesh>
    <sphereGeometry args={[0.3, 16, 16]} />
    <meshStandardMaterial color="#20c997" wireframe />
  </mesh>
);

const Scene = ({ state, emotion, vrmUrl }) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 5]} intensity={1} castShadow />
      <directionalLight position={[-1, 2, 3]} intensity={0.3} color="#ffeedd" />
      <pointLight position={[0, 1, 2]} intensity={0.2} color="#20c997" />

      {vrmUrl ? (
        <VRMAvatar vrmUrl={vrmUrl} state={state} emotion={emotion} />
      ) : (
        <AminaBody state={state} emotion={emotion} />
      )}

      <ContactShadows
        position={[0, -1.2, 0]}
        opacity={0.4}
        scale={3}
        blur={2.5}
        far={2}
      />

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

const STATE_RING_CLASS = {
  listening: styles.ringListening,
  speaking: styles.ringSpeaking,
  processing: styles.ringProcessing,
  greeting: styles.ringSpeaking,
  paused: styles.ringPaused,
  error: styles.ringError,
  initializing: styles.ringProcessing,
};

const STATE_LABEL = {
  initializing: 'Starting...',
  greeting: 'Greeting you...',
  listening: 'Listening...',
  processing: 'Thinking...',
  speaking: 'Speaking...',
  paused: 'Paused',
  error: 'Error',
  idle: '',
};

export const AminaAvatar = ({
  state = 'idle',
  emotion = 'neutral',
  vrmUrl = null,
  className = '',
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const ringClass = STATE_RING_CLASS[state] || '';
  const label = STATE_LABEL[state] || '';
  const isActive = state !== 'idle' && state !== 'paused' && state !== 'error';

  return (
    <div className={`${styles.avatarContainer} ${className}`}>
      {/* Animated ring around avatar */}
      <div className={`${styles.stateRing} ${ringClass} ${isActive ? styles.ringActive : ''}`} />

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

      {/* Bottom indicator: state-specific animations + label */}
      <div className={styles.stateIndicator}>
        {state === 'speaking' && (
          <div className={styles.speakingDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        {state === 'greeting' && (
          <div className={styles.speakingDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        {state === 'listening' && (
          <div className={styles.listeningPulse} />
        )}
        {state === 'processing' && (
          <div className={styles.processingDots}>
            <span className={styles.pdot} />
            <span className={styles.pdot} />
            <span className={styles.pdot} />
          </div>
        )}
        {state === 'paused' && (
          <div className={styles.pausedIcon}>
            <span className={styles.pauseBar} />
            <span className={styles.pauseBar} />
          </div>
        )}
        {state === 'error' && (
          <div className={styles.errorDot} />
        )}
        {state === 'initializing' && (
          <div className={styles.processingDots}>
            <span className={styles.pdot} />
            <span className={styles.pdot} />
            <span className={styles.pdot} />
          </div>
        )}
      </div>

      {/* State label */}
      {label && (
        <div className={`${styles.stateLabel} ${state === 'error' ? styles.stateLabelError : ''}`}>
          {label}
        </div>
      )}
    </div>
  );
};

export default AminaAvatar;
