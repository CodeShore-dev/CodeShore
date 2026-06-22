import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

import { scrollToTop } from '../utils/scroll';

// Top offset that clears the fixed nav for hash deep-links (parity with the
// previous vue-router scrollBehavior `{ el, top: 80 }`).
const HASH_OFFSET = 80;

// Reproduces the four scroll rules from the old vue-router scrollBehavior
// (task 3.1, requirements 9.1-9.4, 8.2), with the same precedence:
//   1. POP (browser back/forward) -> restore the saved position
//   2. hash deep-link            -> scroll to the element minus the nav offset
//   3. path changed (PUSH)       -> scroll to top
//   4. same path, query-only     -> do nothing (no jump on filter/drawer/page)
export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef<Map<string, number>>(new Map());
  const prevPathname = useRef<string | null>(null);
  const currentKey = useRef<string | null>(null);

  // Continuously record the scroll position for the active history entry so
  // it can be restored on POP navigation.
  useEffect(() => {
    const onScroll = () => {
      if (currentKey.current !== null) {
        positions.current.set(currentKey.current, window.scrollY);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const { pathname, hash, key } = location;

    if (navigationType === 'POP') {
      window.scrollTo(0, positions.current.get(key) ?? 0);
    } else if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        const top =
          el.getBoundingClientRect().top + window.scrollY - HASH_OFFSET;
        window.scrollTo({ top });
      }
    } else if (prevPathname.current !== pathname) {
      scrollToTop();
    }
    // else: same path with only a query change -> intentionally no scroll.

    prevPathname.current = pathname;
    currentKey.current = key;
  }, [location, navigationType]);

  return null;
}
