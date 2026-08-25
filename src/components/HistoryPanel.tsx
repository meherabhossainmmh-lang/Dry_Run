import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../state/authStore';
import { api, backendEnabled, type ApiEvent } from '../api/client';
import { onHistoryChanged } from '../api/eventSync';
import Panel from './ui/Panel';

const LEVEL_TINT: Record<ApiEvent['level'], string> = {
  info: 'text-ink/80',
  warn: 'text-alarm',
  error: 'text-alarm',
  security: 'text-flare',
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
 *
 * Live updates: `onHistoryChanged` (fired by eventSync after each
 * successful persist) bumps `refreshKey`, which re-triggers this fetch —
 * so a newly executed command appears here immediately, no manual reload.
 */
export default function HistoryPanel() {
  const { user, token } = useAuthStore();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // firstLoadRef: only the initial fetch (or an account switch) shows "Loading…"
  // — background refreshes stay silent so the panel never flickers.
  const firstLoadRef = useRef(true);
  // expandedRef: true once "Load more" has been used — auto-refresh pauses
  // then, so a reader paging through older history isn't yanked back to page 1.
  const expandedRef = useRef(false);

  // Reset per-account fetch state when the signed-in account changes.
  // (Declared before the fetch effect so the flags are fresh when it runs.)
  useEffect(() => {
    firstLoadRef.current = true;
    expandedRef.current = false;
  }, [user, token]);

  useEffect(() => {
    if (!backendEnabled || !user || !token) {
      setEvents([]);
      setNextCursor(null);
      return;
    }
    let cancelled = false;
    if (firstLoadRef.current) setLoading(true);
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
        if (!cancelled) {
          setLoading(false);
          firstLoadRef.current = false;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, token, refreshKey]);

  // Live updates: refresh the first page whenever a new event is persisted.
  // A short debounce coalesces a burst of events into a single refetch.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onHistoryChanged(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRefreshKey((k) => k + 1), 300);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Cross-client liveness: the in-tab signal above only covers events
  // persisted by THIS browser (your own commands). A light poll every few
  // seconds also picks up other sessions — e.g. a guest driving the arm in
  // another window appears in the admin's history without a manual reload.
  useEffect(() => {
    if (!backendEnabled || !user || !token) return;
    const id = setInterval(() => {
      if (document.hidden) return; // skip background tabs
      if (expandedRef.current) return; // reader paged back — don't disturb
      setRefreshKey((k) => k + 1);
    }, 4000);
    return () => clearInterval(id);
  }, [user, token]);

  // Full history isn't capped at one page anymore — each click fetches the
  // next older page via the cursor the backend handed back, so an account
  // with thousands of saved events stays reachable rather than truncated.
  const loadMore = () => {
    if (!token || nextCursor == null || loadingMore) return;
    expandedRef.current = true;
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

  // Clears the caller's own saved command history (DELETE /api/events is
  // scoped to the authenticated user on the server). Mirrors the same
  // per-user slice the panel displays, so the list visibly empties.
  const clearHistory = () => {
    if (!token || clearing) return;
    if (!window.confirm('Clear your saved command history? This cannot be undone.')) return;
    setClearing(true);
    setError(null);
    api
      .clearHistory(token)
      .then(() => {
        setEvents([]);
        setNextCursor(null);
        expandedRef.current = false;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to clear history');
      })
      .finally(() => setClearing(false));
  };

  if (!backendEnabled) return null;
  if (!user) {
    return (
      <Panel title="Saved command history" delay={300}>
        <div className="num text-[11px] text-dim text-center py-4">
          GUEST MODE: Commands are not being saved to the database.
          Sign in to enable persistence.
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Saved command history"
      delay={300}
      meta={
        <div className="flex items-center gap-1.5">
          <span className="chip">{events.length} saved</span>
          {events.length > 0 && (
            <button
              type="button"
              className="btn px-1.5 py-0.5 text-[10px]"
              onClick={clearHistory}
              disabled={clearing}
              title="Clear your saved command history"
            >
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
        </div>
      }
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
        <div key={e.id} className="flex flex-col text-[11px] leading-relaxed border-b border-hairline/30 pb-1 mb-1">
          <div className="flex items-baseline gap-2">
            <span className="num shrink-0 text-dim">{fmtTime(e.createdAt)}</span>
            <span className="num w-[68px] shrink-0 uppercase text-muted">{e.source}</span>
            <span className={`min-w-0 flex-1 ${LEVEL_TINT[e.level]}`}>{e.message}</span>
          </div>
          {e.user?.email && (
            <div className={`text-[9px] pl-[104px] uppercase tracking-tighter ${e.user.role === 'ADMIN' ? 'text-alarm font-bold' : 'text-flare/60'}`}>
              {e.user.role === 'ADMIN' ? 'Admin' : 'Operator'}: {e.user.email}
            </div>
          )}
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

// contribution audit 2026-07-16 11:00:00
// contribution audit 2026-07-20 10:45:00
// build update 2026-07-20 11:00:00
