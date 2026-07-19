export default function TopBar() {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between overflow-hidden border-b border-hairline bg-carbon px-4 py-2.5">
      {/* A slow instrument sweep across the faceplate. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 opacity-70">
        <div className="sweep h-full w-24 bg-gradient-to-r from-transparent via-flare/10 to-transparent" />
      </div>

      <div className="relative flex items-baseline gap-3">
        <h1 className="font-display text-sm font-bold tracking-[0.22em] text-ink">DRY&nbsp;RUN</h1>
        <span className="num hidden text-[11px] text-dim sm:inline">stylus_arm · 7-DOF</span>
        <span className="hidden text-[11px] text-muted lg:inline">
          one motion pipeline
          <span className="mx-1.5 text-dim">·</span>
          <span className="text-dim">dashboard / joystick / keyboard / voice / autonomous</span>
        </span>
      </div>

      <div className="relative flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="breathe inline-block h-1.5 w-1.5 rounded-full bg-ok" />
          simulation live
        </span>
        <span className="chip border-flare-deep text-flare">Team Straw Hat</span>
      </div>
    </header>
  );
}
