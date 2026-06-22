import { useEffect, useState } from 'react';

// Debounced value hook (task 4.2) — React replacement for VueUse refDebounced.
// Returns `value` after it has stayed unchanged for `delayMs`.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
