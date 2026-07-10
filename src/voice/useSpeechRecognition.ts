/**
 * Push-to-talk speech recognition (PLAN.md Step 7).
 *
 * Wraps the Chrome-only `webkitSpeechRecognition`. Designed for hold-to-talk:
 * call `start()` on pointer-down, `stop()` on pointer-up. The final transcript
 * is delivered via the `onResult` callback so the caller can pipe it straight
 * into `parse()`.
 *
 * Web Speech uses Google's server-side recognizer, so it needs network and is
 * Chrome-only — the typed command box in VoicePanel is the offline fallback
 * (PLAN.md risk #3). `supported` lets the UI hide the mic when unavailable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings — webkitSpeechRecognition isn't in the DOM lib.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

function getCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(
  onResult: (finalTranscript: string) => void,
): UseSpeechRecognition {
  const Ctor = getCtor();
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-creating the recognizer.
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interimText = '';
      let finalText = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? '';
        if (r.isFinal) finalText += t;
        else interimText += t;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        setInterim('');
        cbRef.current(finalText.trim());
      }
    };
    rec.onerror = (ev) => {
      const map: Record<string, string> = {
        'not-allowed': 'Microphone blocked — allow mic access or use the box below.',
        'service-not-allowed': 'Microphone blocked — allow mic access or use the box below.',
        network: 'Speech needs internet — use the typed box.',
        'no-speech': "Didn't catch that — try again.",
      };
      setError(map[ev.error] ?? `Speech error: ${ev.error}`);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    recRef.current = rec;
    return () => {
      rec.onresult = rec.onerror = rec.onend = null;
      rec.abort();
      recRef.current = null;
    };
  }, [Ctor]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec || listening) return;
    setError(null);
    setInterim('');
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() throws if called while already active — ignore.
    }
  }, [listening]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, interim, error, start, stop };
}
