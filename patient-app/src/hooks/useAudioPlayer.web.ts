import { useState, useRef, useCallback } from 'react';
import { ttsAPI } from '../services/api';

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  const play = useCallback(
    async (id: string, text: string) => {
      if (playingId === id) {
        stop();
        return;
      }
      stop();
      setLoadingId(id);

      try {
        const response = await ttsAPI.speak(text);
        const blob = new Blob([response.data], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setPlayingId(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setPlayingId(null);
          audioRef.current = null;
        };

        audioRef.current = audio;
        setLoadingId(null);
        setPlayingId(id);
        await audio.play();
      } catch (error) {
        console.error('TTS playback error:', error);
        setPlayingId(null);
        setLoadingId(null);
      }
    },
    [playingId, stop],
  );

  return { playingId, loadingId, play, stop };
}
