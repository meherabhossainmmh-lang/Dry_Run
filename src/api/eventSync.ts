import { useArmStore, type ArmEvent } from '../state/store';
import { useAuthStore } from '../state/authStore';
import { api, backendEnabled } from './client';

/**
 * Live-update signal: fired after a new event is successfully persisted to
 * the backend. The "Saved Command History" panel subscribes via
 * `onHistoryChanged` so it can refresh without a manual page reload.
 */
type HistoryListener = () => void;
const historyListeners = new Set<HistoryListener>();

export function onHistoryChanged(cb: HistoryListener): () => void {
  historyListeners.add(cb);
  return () => {
    historyListeners.delete(cb);
  };
}

function notifyHistoryChanged(): void {
  historyListeners.forEach((cb) => cb());
}

/**
 * Mirrors new entries from `useArmStore.events` to the backend event log.
 *
 * Deliberately implemented as an external subscriber rather than a change
 * to `useArmStore.log()` itself: every command source already funnels
 * through that one `log()` call (dashboard, joystick, keyboard, voice,
 * agent, autonomous PIN runner — see EventLog.tsx), and persistence is a
 * side effect of that single stream, not a second gate any source has to
 * know about. If the backend is unset or a request fails, the UI is
 * unaffected — this is purely additive logging.
 */
export function startEventSync(): () => void {
  if (!backendEnabled) return () => {};

  let lastSeenId = useArmStore.getState().events[0]?.id ?? 0;

  const forward = (e: ArmEvent) => {
    const token = useAuthStore.getState().token;
    api
      .logEvent({ source: e.source, message: e.msg, level: e.level }, token)
      .then(() => {
        // Persist succeeded — nudge subscribers (the history panel) to
        // refresh so newly executed commands show up live.
        notifyHistoryChanged();
      })
      .catch(() => {
        // Best-effort only — the live in-memory log (EventLog.tsx) remains
        // the source of truth for the current session regardless.
      });
  };

  const unsubscribe = useArmStore.subscribe((state) => {
    const events = state.events;
    if (events.length === 0 || events[0].id === lastSeenId) return;

    // Events are prepended (newest first) and capped at 200 — forward
    // everything newer than the last id we've seen, oldest-first, in the
    // rare case more than one landed between renders.
    const fresh: ArmEvent[] = [];
    for (const e of events) {
      if (e.id === lastSeenId) break;
      fresh.push(e);
    }
    lastSeenId = events[0].id;
    fresh.reverse().forEach(forward);
  });

  return unsubscribe;
}
