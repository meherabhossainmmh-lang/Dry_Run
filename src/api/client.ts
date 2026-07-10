/**
 * Minimal fetch wrapper for the optional Dry Run backend (Feature 1:
 * persistent event log, Feature 2: user accounts). The app runs fully
 * without this — if VITE_API_BASE_URL isn't set, the API calls below are
 * no-ops and everything falls back to the original in-memory-only
 * behaviour. Nothing here sits on a privileged path: it only mirrors what
 * `useArmStore.log()` already recorded locally.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const backendEnabled = Boolean(BASE_URL);

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ApiEvent {
  id: number;
  source: string;
  type?: string | null;
  message: string;
  level: 'info' | 'warn' | 'error' | 'security';
  createdAt: string;
  userId: number | null;
  user?: { email: string; role: string } | null;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(0, 'Backend not configured (VITE_API_BASE_URL is unset)');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string, isAdminLogin: boolean = false) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, isAdminLogin }),
    }),

  me: (token: string) => request<{ user: PublicUser }>('/api/auth/me', {}, token),

  logEvent: (
    event: { source: string; type?: string; message: string; level: 'info' | 'warn' | 'error' },
    token?: string | null,
  ) =>
    request<{ event: ApiEvent }>(
      '/api/events',
      { method: 'POST', body: JSON.stringify(event) },
      token,
    ),

  history: (token: string, opts: { limit?: number; cursor?: number; level?: string } = {}) => {
    const params = new URLSearchParams();
    params.set('limit', String(opts.limit ?? 100));
    if (opts.cursor) params.set('cursor', String(opts.cursor));
    return request<{ events: ApiEvent[]; nextCursor: number | null }>(
      `/api/events?${params.toString()}`,
      {},
      token,
    );
  },

  listUsers: (token: string) => 
    request<{ users: PublicUser[] }>('/api/admin/users', {}, token),

  updateUser: (token: string, id: number, data: { password?: string; isBlocked?: boolean }) =>
    request<{ user: PublicUser }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, token),

  requestCode: (email: string) => 
    request<{ message: string }>('/api/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

export { ApiError };
