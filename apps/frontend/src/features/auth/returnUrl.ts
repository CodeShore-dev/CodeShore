const RETURN_URL_KEY = 'auth.returnUrl';

// A same-site relative path: starts with exactly one '/' (never '//', which
// browsers treat as protocol-relative and would allow an open redirect).
function isSameSiteRelativePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

// Persists the page the user was on before being sent to log in, so it
// survives a full-page redirect (e.g. Supabase OAuth) away from and back to
// the app. Refuses to store anything that isn't a same-site relative path.
export function setReturnUrl(path: string): void {
  if (!isSameSiteRelativePath(path)) {
    return;
  }
  sessionStorage.setItem(RETURN_URL_KEY, path);
}

// Reads and clears the remembered destination in one step, so a later
// unrelated login never reuses a stale value.
export function consumeReturnUrl(): string | null {
  const value = sessionStorage.getItem(RETURN_URL_KEY);
  sessionStorage.removeItem(RETURN_URL_KEY);
  return value;
}
