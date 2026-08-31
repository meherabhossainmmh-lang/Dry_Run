import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../state/authStore';
import { api, backendEnabled, type ApiEvent, type PublicUser } from '../api/client';
import Panel from './ui/Panel';

export default function AdminPanel() {
  const { user, token } = useAuthStore();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  // current-password viewer (admin tool) — the fetched password is stored
  // together with the id of the user it belongs to, so it can NEVER be
  // rendered under the wrong card, no matter the response timing
  const [pwView, setPwView] = useState<{ id: number; password: string | null } | null>(null);
  const [pwVisible, setPwVisible] = useState(true);

  // admin tools state (search / per-user history / delete)
  const [search, setSearch] = useState('');
  const [historyUser, setHistoryUser] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<{ id: number; events: ApiEvent[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  // request guards — a quick switch between users must not let a slow, stale
  // response overwrite the section that is open now
  const pwReqRef = useRef(0);
  const histReqRef = useRef(0);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!backendEnabled || !token || !isAdmin) return;
    refresh();
  }, [token, isAdmin]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.listUsers(token!);
      setUsers(res.users);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (u: PublicUser) => {
    if (!token) return;
    try {
      await api.updateUser(token, u.id, { isBlocked: !u.isBlocked });
      refresh();
    } catch {
      setError('Failed to update user');
    }
  };

  const changePassword = async (id: number) => {
    if (!token || !newPassword) return;
    try {
      await api.updateUser(token, id, { password: newPassword });
      setPwView({ id, password: newPassword }); // keep the shown "current" value in sync
      setNewPassword('');
      setSelectedUser(null);
      alert('Password changed successfully');
    } catch {
      setError('Failed to change password');
    }
  };

  // --- admin tools: open the password section, fetching the current one ---
  const openPassword = async (id: number) => {
    if (selectedUser === id) {
      setSelectedUser(null);
      return;
    }
    setSelectedUser(id);
    setPwView(null);
    setPwVisible(true);
    if (!token) return;
    const req = ++pwReqRef.current; // guard: ignore stale responses after a quick user switch
    try {
      const res = await api.getUserPassword(token, id);
      if (pwReqRef.current === req) setPwView({ id, password: res.password });
    } catch {
      if (pwReqRef.current === req) setPwView({ id, password: null });
    }
  };

  // --- admin tools: delete a user (their saved events stay in the log, detached) ---
  const deleteUser = async (u: PublicUser) => {
    if (!token) return;
    if (!window.confirm(`Delete ${u.name} (${u.email})? Their saved events stay in the log.`)) return;
    try {
      await api.deleteUser(token, u.id);
      refresh();
    } catch {
      setError('Failed to delete user');
    }
  };

  // --- admin tools: open/close one user's saved history ---
  const openHistory = async (id: number) => {
    if (!token) return;
    if (historyUser === id) {
      setHistoryUser(null);
      return;
    }
    setHistoryUser(id);
    setHistoryLoading(true);
    setHistoryData(null);
    const req = ++histReqRef.current; // guard: ignore stale responses after a quick user switch
    try {
      const res = await api.userHistory(token, id);
      if (histReqRef.current === req) setHistoryData({ id, events: res.events });
    } catch {
      if (histReqRef.current === req) setError('Failed to load history');
    } finally {
      if (histReqRef.current === req) setHistoryLoading(false);
    }
  };

  // --- admin tools: clear one user's saved history ---
  const clearUserHistory = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Clear this user's saved command history? This cannot be undone.")) return;
    try {
      await api.clearUserHistory(token, id);
      setHistoryData({ id, events: [] });
    } catch {
      setError('Failed to clear history');
    }
  };

  if (!backendEnabled || !isAdmin) return null;

  const newUsers = users.filter(u => {
    const created = new Date(u.createdAt).getTime();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return created > oneDayAgo;
  });

  // --- admin tools: live stats + search filter (client-side, no backend change) ---
  const stats = {
    total: users.length,
    active: users.filter(u => !u.isBlocked).length,
    blocked: users.filter(u => u.isBlocked).length,
    newAccounts: newUsers.length,
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    : users;

  return (
    <Panel title="Admin: User Management" delay={400}>
      {loading && <div className="text-[11px] text-dim">Loading users...</div>}
      {error && <div className="text-[11px] text-alarm">{error}</div>}

      <div className="mb-4 grid grid-cols-4 gap-1.5">
        <div className="well rounded border border-hairline p-1.5 text-center">
          <div className="text-[13px] font-bold text-ink font-mono">{stats.total}</div>
          <div className="text-[8px] uppercase tracking-widest text-dim">Total</div>
        </div>
        <div className="well rounded border border-ok/30 p-1.5 text-center">
          <div className="text-[13px] font-bold text-ok font-mono">{stats.active}</div>
          <div className="text-[8px] uppercase tracking-widest text-dim">Active</div>
        </div>
        <div className="well rounded border border-alarm/40 p-1.5 text-center">
          <div className="text-[13px] font-bold text-alarm font-mono">{stats.blocked}</div>
          <div className="text-[8px] uppercase tracking-widest text-dim">Blocked</div>
        </div>
        <div className="well rounded border border-flare/40 p-1.5 text-center">
          <div className="text-[13px] font-bold text-flare font-mono">{stats.newAccounts}</div>
          <div className="text-[8px] uppercase tracking-widest text-dim">New 24h</div>
        </div>
      </div>

      {newUsers.length > 0 && (
        <div className="mb-4 space-y-1">
          <div className="text-[9px] uppercase tracking-widest text-flare font-bold">New Accounts (Last 24h)</div>
          {newUsers.map(u => (
            <div key={`new-${u.id}`} className="bg-flare/10 border border-flare/30 p-2 rounded text-[10px]">
               <span className="font-bold text-ink">{u.name}</span> <span className="text-dim">({u.email})</span>
            </div>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Search users by name or email..."
        className="well w-full rounded px-2 py-1.5 text-[11px] text-ink outline-none mb-2"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="text-[9px] uppercase tracking-widest text-dim font-bold mb-1">
        All Users ({filtered.length})
      </div>

      <div className="space-y-2 max-h-[36rem] overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="text-[10px] text-dim text-center py-2">No users match your search.</div>
        )}
        {filtered.map(u => {
          // per-user view of the shared fetched data — scoped by id, so the
          // password/history shown under this card always belongs to THIS user
          const pwReady = pwView != null && pwView.id === u.id;
          const pw = pwReady ? pwView.password : null;
          const evts = historyData != null && historyData.id === u.id ? historyData.events : [];
          return (
          <div key={u.id} className="border border-hairline p-2 rounded bg-void/30">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-ink truncate">{u.name}</div>
                <div className="text-[10px] text-dim truncate">{u.email}</div>
                <div className="text-[9px] text-muted uppercase tracking-tighter">
                  {u.role} · {u.isBlocked ? <span className="text-alarm">BLOCKED</span> : <span className="text-ok">ACTIVE</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button 
                  className={`btn px-2 py-0.5 text-[9px] ${u.isBlocked ? 'btn-ok' : 'btn-alarm'}`}
                  onClick={() => toggleBlock(u)}
                >
                  {u.isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button 
                  className="btn px-2 py-0.5 text-[9px]"
                  onClick={() => openPassword(u.id)}
                >
                  Password
                </button>
                <button
                  className={`btn px-2 py-0.5 text-[9px] ${historyUser === u.id ? 'btn-flare' : ''}`}
                  onClick={() => openHistory(u.id)}
                >
                  History
                </button>
                <button
                  className="btn btn-alarm px-2 py-0.5 text-[9px]"
                  onClick={() => deleteUser(u)}
                >
                  Delete
                </button>
              </div>
            </div>
            
            {selectedUser === u.id && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-dim uppercase tracking-widest shrink-0">Current:</span>
                  <span className="font-mono text-ink min-w-0 truncate">
                    {pwReady ? (pw == null ? 'not recorded yet' : pwVisible ? pw : '••••••••') : '…'}
                  </span>
                  {pwReady && pw != null && (
                    <button
                      className="btn px-1.5 py-0.5 text-[9px] shrink-0"
                      onClick={() => setPwVisible(v => !v)}
                    >
                      {pwVisible ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  <input 
                    type="password"
                    placeholder="New password"
                    className="well flex-1 px-2 py-1 text-[10px]"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button 
                    className="btn px-2 text-[9px]"
                    onClick={() => changePassword(u.id)}
                  >
                    Set
                  </button>
                </div>
              </div>
            )}

            {historyUser === u.id && (
              <div className="mt-2 border-t border-hairline pt-2">
                {historyLoading && <div className="text-[10px] text-dim">Loading history...</div>}
                {!historyLoading && evts.length === 0 && (
                  <div className="text-[10px] text-dim">No saved events for this user.</div>
                )}
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {evts.map(ev => (
                    <div key={ev.id} className="flex gap-2 text-[10px] leading-relaxed">
                      <span className="num shrink-0 text-dim">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                      <span className="num w-[58px] shrink-0 uppercase text-muted">{ev.source}</span>
                      <span className="min-w-0 flex-1 text-ink/80">{ev.message}</span>
                    </div>
                  ))}
                </div>
                {evts.length > 0 && (
                  <button
                    className="btn btn-alarm w-full py-0.5 text-[9px] mt-1.5"
                    onClick={() => clearUserHistory(u.id)}
                  >
                    Clear this user's history
                  </button>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </Panel>
  );
}
