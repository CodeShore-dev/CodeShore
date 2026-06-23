import { SearchInput } from 'codeshore';

const noop = () => {};

export const Empty = () => (
  <div style={{ maxWidth: 360 }}>
    <SearchInput value="" placeholder="搜尋技術關鍵字…" onChange={noop} />
  </div>
);

export const WithValue = () => (
  <div style={{ maxWidth: 360 }}>
    <SearchInput value="TypeScript" placeholder="搜尋技術關鍵字…" onChange={noop} />
  </div>
);
