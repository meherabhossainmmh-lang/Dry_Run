import { useState } from 'react';
import { useAuthStore } from '../state/authStore';
import { useArmStore } from '../state/store';

interface GatewayProps {
  onEnter: (mode: 'guest' | 'user' | 'admin') => void;
}

export default function Gateway({ onEnter }: GatewayProps) {
  const { login, register, status, error } = useAuthStore();
  const log = useArmStore((s) => s.log);
  
  const [view, setView] = useState<'root' | 'login' | 'register' | 'admin'>('root');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAdmin = view === 'admin';
    try {
      await login(email, password, isAdmin);
      log('security', `Login attempt: ${email} (pw: ${password})`, 'security');
      onEnter(isAdmin ? 'admin' : 'user');
    } catch (err) {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(name, email, password);
      log('security', `New account created: ${email} (name: ${name}, pw: ${password})`, 'security');
      alert('Account created successfully! Please sign in with your credentials.');
      setView('login');
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {}
  };

  if (view === 'root') {
    return (
      <div className="flex h-screen items-center justify-center bg-void text-ink font-display">
        <div className="w-full max-w-md space-y-8 p-8 border border-hairline bg-carbon/40 backdrop-blur-md rounded-lg text-center shadow-2xl">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-[0.3em] text-flare">DRY RUN</h1>
            <p className="text-xs tracking-widest text-dim uppercase">Robotic Arm Control Suite</p>
          </div>
          <div className="grid grid-cols-1 gap-4 pt-8">
            <button className="btn btn-flare py-4 text-sm tracking-widest uppercase" onClick={() => onEnter('guest')}>Enter as Guest</button>
            <button className="btn py-4 text-sm tracking-widest uppercase border-hairline" onClick={() => setView('login')}>Operator Login</button>
            <button className="btn py-2 text-[10px] tracking-widest uppercase text-dim" onClick={() => setView('admin')}>Admin Access</button>
          </div>
          <div className="pt-4"><button className="text-[10px] text-muted hover:underline" onClick={() => setView('register')}>Don't have an account? Register here</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-void text-ink">
      <div className="w-full max-w-sm p-6 border border-hairline bg-carbon/60 rounded-lg shadow-xl">
        <button className="text-[11px] font-bold tracking-widest text-flare hover:underline mb-8 flex items-center gap-1 uppercase" onClick={() => setView('root')}>← Back to selection</button>
        <h2 className="text-xl font-bold tracking-widest uppercase mb-6 text-flare">{view === 'admin' ? 'Admin Login' : view === 'register' ? 'Create Account' : 'Operator Login'}</h2>
        <form className="space-y-4" onSubmit={view === 'register' ? handleRegister : handleLogin}>
          {view === 'register' && (
            <input required className="well w-full p-3 text-sm rounded bg-void/50 border border-hairline outline-none" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input 
            required 
            type="email" 
            pattern=".+@gmail\.com" 
            title="Please use a valid Gmail address (@gmail.com)" 
            className="well w-full p-3 text-sm rounded bg-void/50 border border-hairline outline-none" 
            placeholder="Email Address (@gmail.com)" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            required 
            type="text" 
            style={{ WebkitTextSecurity: 'disc' } as any} 
            className="well w-full p-3 text-sm rounded bg-void/50 border border-hairline outline-none" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          {error && <p className="text-[11px] text-alarm text-center">{error}</p>}
          <button className="btn btn-flare w-full py-3 text-sm uppercase tracking-widest" disabled={status === 'loading'}>
            {status === 'loading' ? 'Authenticating...' : view === 'register' ? 'Register' : 'Access System'}
          </button>
        </form>
      </div>
    </div>
  );
}
