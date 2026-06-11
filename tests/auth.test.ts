import { describe, it, expect } from 'vitest';
import { isAuthEnabled, parseCallbackParams } from '../src/auth';

describe('isAuthEnabled', () => {
  it('requires both proxy url and client id', () => {
    expect(isAuthEnabled({ VITE_PROXY_URL: 'https://p', VITE_EEN_CLIENT_ID: 'c' })).toBe(true);
    expect(isAuthEnabled({ VITE_PROXY_URL: 'https://p' })).toBe(false);
    expect(isAuthEnabled({ VITE_EEN_CLIENT_ID: 'c' })).toBe(false);
    expect(isAuthEnabled({})).toBe(false);
    expect(isAuthEnabled({ VITE_PROXY_URL: '', VITE_EEN_CLIENT_ID: '' })).toBe(false);
  });
});

describe('parseCallbackParams', () => {
  it('returns null when no oauth params are present', () => {
    expect(parseCallbackParams('')).toBeNull();
    expect(parseCallbackParams('?foo=bar')).toBeNull();
  });

  it('extracts code and state', () => {
    expect(parseCallbackParams('?code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('reports an IdP-provided error', () => {
    expect(parseCallbackParams('?error=access_denied')).toEqual({
      error: 'OAuth error: access_denied',
    });
  });

  it('reports incomplete params as an error', () => {
    expect(parseCallbackParams('?code=abc')).toEqual({
      error: 'Missing authorization code or state parameter',
    });
    expect(parseCallbackParams('?state=xyz')).toEqual({
      error: 'Missing authorization code or state parameter',
    });
  });
});
