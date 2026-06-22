import { scrollToTop } from '../utils/scroll';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Shared pagination control (task 4.1). Changing page resets scroll to top
// via the single enforced scrollToTop entry point (requirements 6.3, 9.4).
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const goToPage = (page: number): void => {
    if (page < 1 || page > totalPages) return;
    onPageChange(page);
    scrollToTop();
  };

  const showPage = (page: number): boolean =>
    page === 1 ||
    page === totalPages ||
    Math.abs(page - currentPage) <= 1;

  const showEllipsis = (page: number): boolean =>
    page === currentPage - 2 || page === currentPage + 2;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button
        type="button"
        className="bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:text-outline-variant flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
        disabled={currentPage === 1}
        onClick={() => goToPage(currentPage - 1)}
      >
        <span className="material-symbols-outlined text-base">
          chevron_left
        </span>
      </button>

      {pages.map(page =>
        showPage(page) ? (
          <button
            key={page}
            type="button"
            className={`flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg px-2 text-sm font-bold transition-colors ${
              page === currentPage
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
            onClick={() => goToPage(page)}
          >
            {page}
          </button>
        ) : showEllipsis(page) ? (
          <span
            key={page}
            className="text-on-surface-variant px-1 text-sm"
          >
            …
          </span>
        ) : null,
      )}

      <button
        type="button"
        className="bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:text-outline-variant flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
        disabled={currentPage === totalPages}
        onClick={() => goToPage(currentPage + 1)}
      >
        <span className="material-symbols-outlined text-base">
          chevron_right
        </span>
      </button>
    </div>
  );
}
