import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { PageSeo } from '../components/PageSeo';

// Matches the browser-specific wording for a stale/missing lazy-loaded chunk
// (Chrome/Edge, Firefox, Safari respectively). Happens when a client that
// loaded an older build tries to fetch a route chunk that a newer deploy has
// since replaced (content hashes change on every build).
const CHUNK_LOAD_ERROR_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return CHUNK_LOAD_ERROR_PATTERN.test(message);
}

// Root-route errorElement (replaces react-router's default dev-mode error
// screen in production). Also catches render-time errors thrown by
// React.lazy() page chunks, since data routers route those into the nearest
// errorElement rather than an ordinary React error boundary.
export function RouteErrorBoundary() {
  const error = useRouteError();
  const chunkLoadError = isChunkLoadError(error);
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  const title = chunkLoadError
    ? '網站已更新'
    : notFound
      ? '頁面不存在'
      : '發生未預期的錯誤';
  const description = chunkLoadError
    ? '偵測到新版本，請重新整理頁面以繼續使用。'
    : notFound
      ? '此頁面不存在，請返回首頁。'
      : '請重新整理頁面，或返回首頁再試一次。';

  return (
    <>
      <PageSeo title={title} description={description} noIndex />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-4 text-3xl font-black text-[#001f2a]">{title}</h1>
        <p className="mb-8 text-sm text-[#434653]">{description}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[#003d92] px-6 py-2 text-sm font-bold text-white hover:bg-[#002d6e]"
          >
            重新整理
          </button>
          <Link
            to="/"
            className="rounded-lg border border-[#003d92] px-6 py-2 text-sm font-bold text-[#003d92] hover:bg-[#003d92]/5"
          >
            返回首頁
          </Link>
        </div>
      </div>
    </>
  );
}
