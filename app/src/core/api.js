// Thin fetch wrapper for the lumo sync server. Nothing in the UI waits on
// this — sync runs in the background and the app works fully without it.

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status; // 0 = couldn't reach the server
  }
}

export async function api(path, { method = 'GET', body, token, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the lumo server right now.");
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Something went wrong on the server.';
    throw new ApiError(res.status, detail);
  }
  return data;
}
