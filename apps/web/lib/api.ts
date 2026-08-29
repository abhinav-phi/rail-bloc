/** API client — attaches the JWT bearer, normalizes errors.
 *  Ported from the legacy apps/web Vite SPA to Next.js. */

const TOKEN_KEY = 'railbloc_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (body as { detail?: { error?: string } | string })?.detail;
    const msg =
      typeof detail === 'object' && detail !== null && 'error' in detail
        ? String((detail as { error?: string }).error)
        : typeof detail === 'string'
          ? detail
          : `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, msg, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};

export interface MeInfo {
  username: string;
  role: string;
  division: string;
}

/** Parse the payload from a JWT without verification (client-side display only). */
export function parseJwt(token: string | null): MeInfo | null {
  if (!token) return null;
  try {
    const p = token.split('.')[1] ?? '';
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(window.atob(b64)))) as MeInfo;
  } catch {
    return null;
  }
}
