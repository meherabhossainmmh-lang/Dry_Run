import { useAuthStore } from '../state/authStore';
import { useArmStore } from '../state/store';

export default function TopBar({ onLogout }: { onLogout: () => void }) {
  const { user, logout } = useAuthStore();
  const { log, clearLogs } = useArmStore();

  const handleSignOut = () => {
    if (user) {
      log('security', `User logged out: ${user.email}`, 'security');
    }
    // Small delay to allow the event sync to capture the token before it's cleared
    setTimeout(() => {
      logout();
      clearLogs();
      onLogout();
    }, 100);
  };

  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between overflow-hidden border-b border-hairline bg-carbon px-4 py-2.5">
      {/* A slow instrument sweep across the faceplate. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-70">
        <div className="sweep h-full w-24 bg-gradient-to-r from-transparent via-flare/10 to-transparent" />
      </div>

      <div className="relative flex items-baseline gap-3">
        <h1 className="font-display text-sm font-bold tracking-[0.22em] text-ink">DRY&nbsp;RUN</h1>
        <span className="num hidden text-[11px] text-dim sm:inline">stylus_arm · 7-DOF</span>
        <span className="hidden text-[11px] text-muted lg:inline uppercase tracking-tighter">
          {user ? `${user.role} MODE` : 'GUEST MODE'}
        </span>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="breathe inline-block h-1.5 w-1.5 rounded-full bg-ok" />
          simulation live
        </span>
        <button onClick={handleSignOut} className="btn px-3 py-1 text-[10px] border-hairline hover:text-flare">
          {user ? 'Logout' : 'Exit Guest Mode'}
        </button>
      </div>
    </header>
  );
}

