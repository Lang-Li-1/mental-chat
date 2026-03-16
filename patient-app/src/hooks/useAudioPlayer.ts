import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ttsAPI } from '../services/api';

export function useAudioPlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setPlayingId(null);
    setLoadingId(null);
  }, []);

  const play = useCallback(
    async (id: string, text: string) => {
      if (playingId === id) {
        await stop();
        return;
      }
      await stop();
      setLoadingId(id);

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const response = await ttsAPI.speak(text);
        const base64 = await blobToBase64(response.data);
        const fileUri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingId(null);
            sound.unloadAsync();
            soundRef.current = null;
            FileSystem.deleteAsync(fileUri, { idempotent: true });
          }
        });

        setLoadingId(null);
        setPlayingId(id);
        await sound.playAsync();
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
