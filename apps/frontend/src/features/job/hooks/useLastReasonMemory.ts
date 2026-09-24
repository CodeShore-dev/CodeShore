export interface LastReasonMemory {
  read: (preference: 'like' | 'dislike') => string | null;
  remember: (preference: 'like' | 'dislike', reason: string) => void;
}

// Namespaced localStorage keys, kept separate per preference so that a
// "like" pick never bleeds into the "dislike" flow's preselection
// (requirement 6.3).
function keyFor(preference: 'like' | 'dislike'): string {
  return `codeshore:lastPreferenceReason:${preference}`;
}

// Reads the last-remembered reason for a preference. Any failure accessing
// localStorage (blocked storage, throwing accessor, etc.) is treated the
// same as "nothing remembered" rather than surfacing an error (requirement
// 6.5).
function read(preference: 'like' | 'dislike'): string | null {
  try {
    return window.localStorage.getItem(keyFor(preference));
  } catch {
    return null;
  }
}

// Persists the last-picked reason for a preference. Failures are silently
// ignored so a blocked/unavailable localStorage never breaks the marking
// flow (requirement 6.5).
function remember(preference: 'like' | 'dislike', reason: string): void {
  try {
    window.localStorage.setItem(keyFor(preference), reason);
  } catch {
    // Storage unavailable or blocked -- nothing to remember, flow continues.
  }
}

// Module-level functions carry no per-render identity, so the returned
// object's methods are stable across re-renders and safe to use in
// dependency arrays (requirement 6.1).
const lastReasonMemory: LastReasonMemory = { read, remember };

export function useLastReasonMemory(): LastReasonMemory {
  return lastReasonMemory;
}
