import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Providers } from './app/providers';
import { createHttpClient } from './httpClient';
import addAuthorizationHeader from './httpClient/interceptors/onRequest/addAuthorizationHeader';
import errorHandleResponse from './httpClient/interceptors/onResponse/errorHandleResponse';
import transformResponse from './httpClient/interceptors/onResponse/transformResponse';
import beforeCreate from './httpClient/lifecycle/beforeCreate';
import './styles.css';

// Preserve the existing axios httpClient initialization (framework-agnostic):
// interceptor pipeline injects the Supabase token and transforms/handles responses.
createHttpClient(
  { beforeCreate },
  {
    request: {
      usesOnFullFilled: [addAuthorizationHeader],
    },
    response: {
      usesOnFullFilled: [transformResponse],
      usesOnRejected: [errorHandleResponse],
    },
  },
);

// A stale client (open before a deploy replaced the hashed chunk files, or
// routed to a different backend build) can fail to fetch a lazy-loaded route
// chunk. Vite's dynamic-import wrapper fires this event in that case; reload
// once to pick up the current build instead of surfacing an error screen.
// The timestamp guard (rather than a one-shot flag) allows a fresh
// auto-reload the next time this happens later in the same tab session,
// while still stopping a tight reload loop if the chunk is genuinely
// unreachable (e.g. offline).
window.addEventListener('vite:preloadError', () => {
  const key = 'chunk-reload-attempted-at';
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
});

// index.html ships static description/OG/Twitter/canonical tags so
// non-JS crawlers (link-preview bots) see real metadata. Once React mounts
// and <PageSeo> renders the route-specific versions, drop the static ones
// so they don't coexist with React's as duplicate <title>/canonical/meta.
document
  .querySelectorAll('[data-static-seo]')
  .forEach(el => el.remove());

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
);

