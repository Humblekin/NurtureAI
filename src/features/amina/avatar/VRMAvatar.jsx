import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { VRMUtils, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


/**
 * VRM Avatar Loader
 * Loads a .vrm model file and animates it based on state (idle, speaking, listening).
 * Falls back to procedural avatar if no VRM file is provided.
 */

const VRMAvatar = ({ vrmUrl, state = 'idle', emotion = 'neutral' }) => {
  const vrmRef = useRef();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!vrmUrl) return;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      vrmUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm;
        if (vrm) {
          VRMUtils.removeUnnecessaryJoints(vrm.scene);
          vrmRef.current = vrm;
          setLoaded(true);
        }
      },
      undefined,
      (error) => {
        console.warn('VRM load failed, using procedural avatar:', error);
      }
    );

    return () => {
      if (vrmRef.current) {
        vrmRef.current.scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
    };
  }, [vrmUrl]);

  useFrame((clock) => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    const t = clock.clock.elapsedTime;

    // Update VRM blink expression
    if (vrm.expressionManager) {
      const blink = Math.sin(t * 0.3) > 0.98 ? 1 : 0;
      vrm.expressionManager.setValue('blink', blink);

      // Emotion expressions
      if (emotion === 'happy') {
        vrm.expressionManager.setValue('happy', 0.7);
        vrm.expressionManager.setValue('angry', 0);
        vrm.expressionManager.setValue('sad', 0);
      } else if (emotion === 'concerned') {
        vrm.expressionManager.setValue('sad', 0.4);
        vrm.expressionManager.setValue('happy', 0);
      } else {
        vrm.expressionManager.setValue('happy', 0);
        vrm.expressionManager.setValue('sad', 0);
        vrm.expressionManager.setValue('angry', 0);
      }
    }

    // Idle breathing
    if (vrm.humanoid) {
      const spine = vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        spine.rotation.x = Math.sin(t * 1.5) * 0.02;
      }

      const head = vrm.humanoid.getNormalizedBoneNode('head');
      if (head) {
        head.rotation.x = Math.sin(t * 0.7) * 0.03;
        head.rotation.y = Math.sin(t * 0.5) * 0.02;
      }

      // Speaking animation
      if (state === 'speaking' && vrm.expressionManager) {
        vrm.expressionManager.setValue('aa', Math.abs(Math.sin(t * 12)) * 0.8);
        vrm.expressionManager.setValue('oh', Math.abs(Math.sin(t * 8)) * 0.4);
      } else {
        if (vrm.expressionManager) {
          vrm.expressionManager.setValue('aa', 0);
          vrm.expressionManager.setValue('oh', 0);
        }
      }

      // Listening nod
      if (state === 'listening') {
        const head = vrm.humanoid.getNormalizedBoneNode('head');
        if (head) {
          head.rotation.x = Math.sin(t * 2) * 0.08;
        }
      }
    }

    vrm.update(clock.clock.deltaTime);
  });

  if (!loaded || !vrmRef.current) return null;

  return <primitive object={vrmRef.current.scene} />;
};

export default VRMAvatar;
