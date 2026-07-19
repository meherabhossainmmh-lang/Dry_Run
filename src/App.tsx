import Viewport from './components/Viewport';
import TopBar from './components/TopBar';
import TcpReadout from './components/TcpReadout';
import PinPad from './components/PinPad';
import JointPanel from './components/JointPanel';
import GotoPanel from './components/GotoPanel';
import Joystick from './components/Joystick';
import ManualPanel from './components/ManualPanel';
import EventLog from './components/EventLog';
import VoicePanel from './voice/VoicePanel';
import AgentPanel from './voice/AgentPanel';

/**
 * Ground Control — the console layout.
 *
 * The 3D scene is the instrument you watch, so it takes the whole stage with
 * telemetry floated over it. The event log docks full-width beneath it because
 * it is the visible proof of the architecture: every source, one gate. The rail
 * is ordered by what the arm is for — autonomy first, then the ways a human or
 * an agent can drive it.
 */
export default function App() {
  return (
    <div className="atmosphere flex h-screen flex-col bg-void text-ink">
      <TopBar />

      <div className="relative z-[2] flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Viewport />
            {/* Heads-up telemetry — pointer-events-none, so orbit stays reachable. */}
            <div className="pointer-events-none absolute left-4 top-4">
              <TcpReadout />
            </div>
          </div>

          <div className="h-[13.5rem] shrink-0">
            <EventLog />
          </div>
        </main>

        <aside className="flex w-80 shrink-0 flex-col gap-2.5 overflow-y-auto border-l border-hairline bg-carbon/60 p-3 lg:w-[23rem]">
          <PinPad />
          <JointPanel />
          <VoicePanel />
          <AgentPanel />
          <GotoPanel />
          <Joystick />
          <ManualPanel />
        </aside>
      </div>
    </div>
  );
}
