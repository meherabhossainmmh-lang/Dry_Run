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

// build update 2026-07-27 18:30:00
// build update 2026-07-22 15:00:00
// activity 1784508180.0 0.7323773326342772
// activity 1784549700.0 0.2249277775162447
// activity 1784609280.0 0.20989117683823566
// activity 1784621880.0 0.2235119670708623
// activity 1784636580.0 0.6504054864951436
// activity 1784650680.0 0.5710198631197053
// activity 1784737320.0 0.44252894299854106
// activity 1784811480.0 0.423652266663064
// activity 1784852640.0 0.5254780424121369
// activity 1784894460.0 0.02740226384382949
// activity 1784966760.0 0.31084973190077747
// activity 1785112200.0 0.6114275488342417
// activity 1785126720.0 0.5213034538028302
// activity 1785154860.0 0.22272866884874964
// activity 1785198900.0 0.9830641600597314
// activity 1785228360.0 0.5452037745645332
// activity 1785286620.0 0.8643256840475209
// activity 1785327780.0 0.0533595177223084
// activity 1785401880.0 0.8494775942992049
// activity 1785415980.0 0.6842884128743368
// activity 1785529080.0 0.08896280058934747
// activity 1785559860.0 0.5116579475873654