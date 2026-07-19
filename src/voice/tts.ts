/**
 * Text-to-speech feedback — "TTS short + cancel-on-PTT" (PLAN.md Step 7).
 *
 * Thin wrapper over the browser SpeechSynthesis API. Every `speak()` cancels any
 * in-flight utterance first so confirmations never queue up or talk over a new
 * command (barge-in). Degrades silently where the API is missing.
 */

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' ? window.speechSynthesis : undefined;

export function ttsSupported(): boolean {
  return !!synth;
}

/** Stop any current speech immediately (also used on PTT press and "stop"). */
export function cancelSpeech(): void {
  synth?.cancel();
}

/** Speak a short phrase, cancelling anything already in progress. */
export function speak(text: string): void {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1;
  u.volume = 1;
  synth.speak(u);
}
