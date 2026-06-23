import { Pagination } from 'codeshore';

const noop = () => {};

export const MiddlePage = () => (
  <Pagination currentPage={5} totalPages={12} onPageChange={noop} />
);

export const FirstPage = () => (
  <Pagination currentPage={1} totalPages={8} onPageChange={noop} />
);

export const LastPage = () => (
  <Pagination currentPage={9} totalPages={9} onPageChange={noop} />
);
