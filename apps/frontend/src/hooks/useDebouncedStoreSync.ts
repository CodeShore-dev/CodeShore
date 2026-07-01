import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

import { useDebouncedValue } from './useDebouncedValue';

// Debounces a locally-typed value and pushes it into a store once the user
// stops typing, while also pulling in external store changes (e.g. "clear
// all", URL restore) back into local state. Replaces the hand-rolled
// local-state + two-effect pattern that was duplicated per filter field.
export function useDebouncedStoreSync<T>(
  storeValue: T,
  setStoreValue: (value: T) => void,
  delayMs: number,
): [T, Dispatch<SetStateAction<T>>] {
  const [local, setLocal] = useState(storeValue);
  const debounced = useDebouncedValue(local, delayMs);

  useEffect(() => {
    if (debounced !== storeValue) setStoreValue(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (storeValue !== local) setLocal(storeValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeValue]);

  return [local, setLocal];
}
