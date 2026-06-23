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

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

createRoot(container).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
);

