export function setPageIndex(
  url: string,
  pageIndex: number,
) {
  const urlObject = new URL(url);
  urlObject.searchParams.set('page', pageIndex.toString());
  return urlObject.toString();
}

export function getPageIndex(url: string) {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('page');
}

export function generateNextUrlToEnqueue(url: string) {
  const urlsToEnqueue = [];
  const nextUrl = new URL(url);
  const page = parseInt(getPageIndex(url) || '1');
  nextUrl.searchParams.set('page', (page + 1).toString());
  urlsToEnqueue.push(nextUrl.toString());
  return urlsToEnqueue;
}

export function getIdFromUrl(url: string) {
  const urlObj = new URL(url);
  return urlObj.pathname
    .split('/')
    .filter(Boolean)
    .slice(-1)[0];
}
