/**
 * Groq chat client for the agentic voice layer (PLAN.md Phase 3B).
 *
 * OpenAI-compatible endpoint. Primary model `openai/gpt-oss-120b`, automatic
 * fallback to `llama-3.3-70b-versatile` on any primary failure. JSON mode +
 * temperature 0 for stable, parseable output (we still zod-validate downstream).
 *
 * The key lives in localStorage (set via the panel gear) or, for local dev,
 * VITE_GROQ_API_KEY — it is NEVER bundled or committed. Called straight from the
 * browser: hackathon scope, single-user demo.
 */
export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const PRIMARY_MODEL = 'openai/gpt-oss-120b';
export const FALLBACK_MODEL = 'llama-3.3-70b-versatile';
const KEY_STORAGE = 'groq_api_key';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function envKey(): string | undefined {
  return (import.meta.env as Record<string, string | undefined>).VITE_GROQ_API_KEY;
}

export function getApiKey(): string | null {
  const ls = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
  return (ls && ls.trim()) || envKey() || null;
}
export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}
export function clearApiKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}
export function hasApiKey(): boolean {
  return !!getApiKey();
}

async function callModel(model: string, messages: ChatMessage[], key: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq returned no message content.');
  return content;
}

/** Chat completion returning the raw JSON string. Falls back to the smaller model. */
export async function chatJSON(messages: ChatMessage[]): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('No Groq API key — add one with the gear button.');
  try {
    return await callModel(PRIMARY_MODEL, messages, key);
  } catch {
    // Primary model unavailable / rate-limited → try the fallback once.
    return await callModel(FALLBACK_MODEL, messages, key);
  }
}
