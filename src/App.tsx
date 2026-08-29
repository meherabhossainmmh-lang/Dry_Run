import { useState, useEffect } from 'react';
import { useAuthStore } from './state/authStore';
import { useArmStore } from './state/store';
import Viewport from './components/Viewport';
import TopBar from './components/TopBar';
import TcpReadout from './components/TcpReadout';
import PinPad from './components/PinPad';
import JointPanel from './components/JointPanel';
import Joystick from './components/Joystick';
import ManualPanel from './components/ManualPanel';
import EventLog from './components/EventLog';
import VoicePanel from './voice/VoicePanel';
import AgentPanel from './voice/AgentPanel';
import HistoryPanel from './components/HistoryPanel';
import AdminPanel from './components/AdminPanel';
import Gateway from './components/Gateway';

export default function App() {
  const { user, status, logout } = useAuthStore();
  const { log, clearLogs } = useArmStore();
  const [entryMode, setEntryMode] = useState<'guest' | 'user' | 'admin' | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && user && !entryMode) {
      setEntryMode(user.role === 'ADMIN' ? 'admin' : 'user');
    }
  }, [status, user, entryMode]);

  const handleModeChange = (mode: 'guest' | 'user' | 'admin' | null) => {
    // Guest exit is auditable too — logged BEFORE the session log is
    // cleared, so it still syncs to the backend anonymously and shows up
    // in the admin's history with the red (Guest) tag.
    if (mode === null && entryMode === 'guest') {
      log('system', 'Guest session ended', 'info');
    }
    clearLogs();
    // Guest entry is itself auditable activity — it syncs to the backend
    // anonymously (no account), so the admin's history shows it with a
    // time and the red (Guest) tag.
    if (mode === 'guest') log('system', 'Guest session started', 'info');
    setEntryMode(mode);
  };

  const handleAdminLogout = () => {
    if (user) {
      log('security', `Admin logged out: ${user.email}`, 'security');
    }
    setTimeout(() => {
      logout();
      handleModeChange(null);
    }, 100);
  };

  if (!entryMode) {
    return <Gateway onEnter={handleModeChange} />;
  }

  if (entryMode === 'admin' || user?.role === 'ADMIN') {
    return (
      <div className="atmosphere flex h-screen flex-col bg-void text-ink scale-in">
        <TopBar onLogout={() => handleModeChange(null)} />
        <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
           <div className="flex justify-between items-center border-b border-hairline pb-4">
              <h2 className="text-xl font-bold tracking-widest text-flare uppercase">Administrator Console</h2>
              <button onClick={handleAdminLogout} className="btn px-4 py-1.5 text-[11px] border-alarm-deep text-alarm hover:bg-alarm/10 uppercase tracking-widest">
                Admin Logout
              </button>
           </div>
           <AdminPanel />
           <HistoryPanel />
        </main>
      </div>
    );
  }

  return (
    <div className="atmosphere flex h-screen flex-col bg-void text-ink scale-in">
      <TopBar onLogout={() => handleModeChange(null)} />

      <div className="relative z-[2] flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Viewport />
            <div className="pointer-events-none absolute left-4 top-4">
              <TcpReadout />
            </div>
          </div>
          <div className="h-[13.5rem] shrink-0">
            <EventLog />
          </div>
        </main>

        <aside className="flex w-80 shrink-0 flex-col gap-2.5 overflow-y-auto border-l border-hairline bg-carbon/60 p-3 lg:w-[23rem]">
          <div className="flex justify-between items-center px-1">
             <button onClick={() => handleModeChange(null)} className="text-[10px] text-dim hover:text-flare uppercase tracking-widest">← Back to Gateway</button>
          </div>
          <HistoryPanel />
          <PinPad />
          <JointPanel />
          <VoicePanel />
          <AgentPanel />
          <Joystick />
          <ManualPanel />
        </aside>
      </div>
    </div>
  );
}
