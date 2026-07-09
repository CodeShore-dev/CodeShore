import { Link } from 'react-router';

import { PageSeo } from '../../../components/PageSeo';

/**
 * 404 not-found page (task 4.1).
 *
 * Renders a Chinese "page not found" message with a link back to the home
 * page. Uses PageSeo with noIndex=true so the 404 page is never indexed.
 */
export function NotFoundPage() {
  return (
    <>
      <PageSeo
        title="頁面不存在"
        description="此頁面不存在，請返回首頁。"
        noIndex
      />
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-4 text-3xl font-black text-[#001f2a]">頁面不存在</h1>
        <p className="mb-8 text-sm text-[#434653]">
          此頁面不存在，請返回首頁。
        </p>
        <Link
          to="/"
          className="rounded-lg bg-[#003d92] px-6 py-2 text-sm font-bold text-white hover:bg-[#002d6e]"
        >
          返回首頁
        </Link>
      </div>
    </>
  );
}
