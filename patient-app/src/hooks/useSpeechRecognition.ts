import { useState, useEffect, useCallback } from 'react';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());

    const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event) => {
      if (event.results && event.results.length > 0) {
        onTranscript(event.results[0].transcript);
      }
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener('error', () => {
      setIsRecording(false);
    });

    const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
      setIsRecording(false);
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
      endSub.remove();
    };
  }, [onTranscript]);

  const start = useCallback(async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

    ExpoSpeechRecognitionModule.start({
      lang: 'zh-CN',
      interimResults: true,
      continuous: true,
    });
    setIsRecording(true);
  }, []);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, isAvailable, start, stop };
}
