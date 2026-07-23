import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/authStore';
import { api, backendEnabled, type ApiEvent } from '../api/client';
import Panel from './ui/Panel';

const LEVEL_TINT: Record<ApiEvent['level'], string> = {
  info: 'text-ink/80',
  warn: 'text-alarm',
  error: 'text-alarm',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

/**
 * "View My Saved Command History" — the persisted counterpart to the
 * live, in-memory Event log. Only meaningful for a Registered Operator:
 * it reads back what the backend has stored for their account via
 * GET /api/events, independent of whatever's currently in
 * `useArmStore.events` (which resets on page reload).
 */
export default function HistoryPanel() {
  const { user, token } = useAuthStore();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backendEnabled || !user || !token) {
      setEvents([]);
      setNextCursor(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .history(token)
      .then(({ events, nextCursor }) => {
        if (!cancelled) {
          setEvents(events);
          setNextCursor(nextCursor);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, token]);

  // Full history isn't capped at one page anymore — each click fetches the
  // next older page via the cursor the backend handed back, so an account
  // with thousands of saved events stays reachable rather than truncated.
  const loadMore = () => {
    if (!token || nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    api
      .history(token, { cursor: nextCursor })
      .then(({ events: more, nextCursor: nc }) => {
        setEvents((prev) => [...prev, ...more]);
        setNextCursor(nc);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load more history');
      })
      .finally(() => setLoadingMore(false));
  };

  if (!backendEnabled || !user) return null;

  return (
    <Panel
      title="Saved command history"
      delay={300}
      meta={<span className="chip">{events.length} saved</span>}
      bodyClassName="max-h-40 overflow-y-auto space-y-0.5 pr-1"
    >
      {loading && <div className="num text-[11px] text-dim">Loading…</div>}
      {error && <div className="text-[11px] text-alarm">{error}</div>}
      {!loading && !error && events.length === 0 && (
        <div className="num text-[11px] text-dim">
          No saved events yet — persisted rows appear here once the pipeline logs something
          while you're signed in.
        </div>
      )}
      {events.map((e) => (
        <div key={e.id} className="flex items-baseline gap-2 text-[11px] leading-relaxed">
          <span className="num shrink-0 text-dim">{fmtTime(e.createdAt)}</span>
          <span className="num w-[68px] shrink-0 uppercase text-muted">{e.source}</span>
          <span className={`min-w-0 ${LEVEL_TINT[e.level]}`}>{e.message}</span>
        </div>
      ))}
      {nextCursor != null && (
        <button
          className="btn w-full py-1 text-[10px]"
          onClick={loadMore}
          disabled={loadingMore}
          type="button"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </Panel>
  );
}
