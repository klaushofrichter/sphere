// The ONLY module that imports een-api-toolkit. Components use these
// wrappers so the toolkit surface stays in one place.
import {
  initEenToolkit,
  getAuthUrl,
  handleAuthCallback,
  revokeToken,
  getCurrentUser,
  useAuthStore,
} from 'een-api-toolkit';

/** Pure check: auth is enabled iff both env values are non-empty. */
export function isAuthEnabled(env: Record<string, unknown>): boolean {
  return Boolean(env.VITE_PROXY_URL) && Boolean(env.VITE_EEN_CLIENT_ID);
}

export const authEnabled = isAuthEnabled(import.meta.env);

/** Call once from main.ts, after app.use(createPinia()). */
export function initAuth(): void {
  initEenToolkit({
    proxyUrl: import.meta.env.VITE_PROXY_URL,
    clientId: import.meta.env.VITE_EEN_CLIENT_ID,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    // localStorage so sessions survive reloads and Playwright can restore
    // them via storageState (the proxy keeps refresh tokens server-side).
    storageStrategy: 'localStorage',
  });
}

export type CallbackParams = { code: string; state: string } | { error: string } | null;

/** Pure parser for the OAuth callback query string. */
export function parseCallbackParams(search: string): CallbackParams {
  const p = new URLSearchParams(search);
  const err = p.get('error');
  if (err) return { error: `OAuth error: ${err}` };
  const code = p.get('code');
  const state = p.get('state');
  if (code && state) return { code, state };
  if (code || state) return { error: 'Missing authorization code or state parameter' };
  return null;
}

/** Redirect to the EEN Identity Provider. */
export function login(): void {
  window.location.href = getAuthUrl();
}

/**
 * Complete an OAuth callback if the URL carries one.
 * Returns an error message, or null when there was no callback / it succeeded.
 * Always cleans the query string from the URL.
 */
export async function completeCallback(): Promise<string | null> {
  const parsed = parseCallbackParams(window.location.search);
  if (!parsed) return null;
  // Clean the URL before the exchange: auth codes are single-use, so keeping
  // them in the URL would only enable a doomed retry on reload.
  history.replaceState(null, '', window.location.pathname);
  if ('error' in parsed) return parsed.error;
  const { error } = await handleAuthCallback(parsed.code, parsed.state);
  return error ? error.message : null;
}

/** Revoke the token (proxy clears the session) and reset auth state. */
export async function logout(): Promise<void> {
  await revokeToken();
}

/** One toolkit API call to prove end-to-end access; null on any error. */
export async function fetchUserEmail(): Promise<string | null> {
  const { data, error } = await getCurrentUser();
  return error ? null : (data.email ?? null);
}

export { useAuthStore };
