import { useState, type FormEvent } from 'react';
import { useAuthStore } from '../state/authStore';
import { backendEnabled } from '../api/client';
import { useArmStore } from '../state/store';
import Panel from './ui/Panel';

type Mode = 'login' | 'register';

/**
 * Registered Operator sign-in/registration. Purely additive to the
 * existing arm-control surface — a Guest Operator can ignore this panel
 * entirely and every existing lane (dashboard/joystick/keyboard/voice/PIN)
 * keeps working exactly as before. Signing in only changes whose account
 * the persisted command history (see HistoryPanel) is filed under.
 */
/**
 * AuthPanel with support for persistent user sessions.
 */
export default function AuthPanel() {
  const { user, status, error, login, register, logout } = useAuthStore();
  const log = useArmStore((s) => s.log);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!backendEnabled) return null;

  const changeMode = (newMode: Mode) => {
    setMode(newMode);
    setName('');
    setEmail('');
    setPassword('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'register') {
        await register(name.trim(), email.trim(), password);
        log('system', `Account registered for ${email.trim()}`, 'info');
      } else {
        await login(email.trim(), password);
        log('system', `Signed in as ${email.trim()}`, 'info');
      }
      setName('');
      setEmail('');
      setPassword('');
    } catch {
      // authStore already captured the error message; nothing else to do.
    }
  };

  if (user) {
    return (
      <Panel title="Operator account" delay={280}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] text-ink">{user.name}</div>
            <div className="truncate text-[10px] text-dim">{user.email}</div>
          </div>
          <button
            className="btn px-2.5 py-1 text-[10px]"
            onClick={() => {
              logout();
              log('system', 'Signed out', 'info');
            }}
          >
            Sign out
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Operator account"
      delay={280}
      meta={
        <div className="flex gap-1">
          <button
            className={`chip cursor-pointer ${mode === 'login' ? 'text-flare border-flare-deep' : ''}`}
            onClick={() => changeMode('login')}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`chip cursor-pointer ${mode === 'register' ? 'text-flare border-flare-deep' : ''}`}
            onClick={() => changeMode('register')}
            type="button"
          >
            Register
          </button>
        </div>
      }
    >
      <form className="space-y-2" onSubmit={submit}>
        {mode === 'register' && (
          <input
            className="well w-full rounded px-2 py-1.5 text-[11px] text-ink"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          className="well w-full rounded px-2 py-1.5 text-[11px] text-ink"
          placeholder="Email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="well w-full rounded px-2 py-1.5 text-[11px] text-ink"
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-[10px] text-alarm">{error}</p>}
        <button className="btn btn-flare w-full py-1.5 text-[11px]" disabled={status === 'loading'}>
          {status === 'loading' ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="text-[10px] text-dim">
          Guest Operators can keep using every control lane without signing in — this only
          enables saving your command history to your account.
        </p>
      </form>
    </Panel>
  );
}
