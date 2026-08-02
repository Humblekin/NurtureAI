import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, AlertCircle } from 'lucide-react';
import styles from './VoiceRecorder.module.css';

export default function VoiceRecorder({ onRecordingComplete, onRecordingDelete, existingAudioUrl }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl || null);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not available in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, url);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('VoiceRecorder error:', err);
      let errorMessage = 'Cannot record: An unknown error occurred.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Cannot record: Microphone access was denied. Please check your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Cannot record: No microphone was detected.';
      } else if (err.message) {
        errorMessage = `Cannot record: ${err.message}`;
      }
      
      setError(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const deleteRecording = () => {
    setAudioUrl(null);
    setDuration(0);
    if (onRecordingDelete) {
      onRecordingDelete();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={styles.recorderContainer}>
      {!audioUrl ? (
        <div className={styles.recorderControls}>
          <button 
            type="button"
            className={`${styles.recordBtn} ${isRecording ? styles.recording : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
          
          <div className={styles.statusText}>
            {isRecording ? `Recording... ${formatDuration(duration)}` : 'Tap to record a voice note'}
          </div>
        </div>
      ) : (
        <div className={styles.playbackContainer}>
          <audio controls src={audioUrl} className={styles.audioPlayer} />
          <button 
            type="button" 
            className={styles.deleteBtn} 
            onClick={deleteRecording}
            title="Delete recording"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {error && (
        <div className={styles.errorText}>
          <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
          {error}
        </div>
      )}
    </div>
  );
}
