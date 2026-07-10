import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/authStore';
import { api, backendEnabled, type PublicUser } from '../api/client';
import Panel from './ui/Panel';

export default function AdminPanel() {
  const { user, token } = useAuthStore();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

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
      setNewPassword('');
      setSelectedUser(null);
      alert('Password changed successfully');
    } catch {
      setError('Failed to change password');
    }
  };

  if (!backendEnabled || !isAdmin) return null;

  const newUsers = users.filter(u => {
    const created = new Date(u.createdAt).getTime();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return created > oneDayAgo;
  });

  return (
    <Panel title="Admin: User Management" delay={400}>
      {loading && <div className="text-[11px] text-dim">Loading users...</div>}
      {error && <div className="text-[11px] text-alarm">{error}</div>}
      
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

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {users.map(u => (
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
                  onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                >
                  Password
                </button>
              </div>
            </div>
            
            {selectedUser === u.id && (
              <div className="mt-2 flex gap-1">
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
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
