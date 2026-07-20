import { create } from 'zustand';
import { api, backendEnabled, type PublicUser } from '../api/client';

const TOKEN_KEY = 'dryrun.token';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

/**
 * Registered Operator session state. Kept deliberately separate from
 * `useArmStore` — auth is orthogonal to arm state, and every existing
 * consumer of `useArmStore` should be unaffected by this feature existing
 * at all when no backend is configured.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: 'idle',
  error: null,

  register: async (name, email, password) => {
    set({ status: 'loading', error: null });
    try {
      const { token, user } = await api.register(name, email, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user, status: 'authenticated' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Registration failed' });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const { token, user } = await api.login(email, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user, status: 'authenticated' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : 'Login failed' });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null, status: 'idle', error: null });
  },

  restore: async () => {
    if (!backendEnabled) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    set({ status: 'loading' });
    try {
      const { user } = await api.me(token);
      set({ token, user, status: 'authenticated' });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null, status: 'idle' });
    }
  },
}));
