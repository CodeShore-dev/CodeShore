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

/**
 * 回傳代表「job source」本身的鍵值:同一 job source 分頁時只有 `page`
 * query param 不同,移除該參數後即可用來辨識「這幾頁其實屬於同一個來源」。
 */
export function getSourceKey(url: string) {
  const urlObj = new URL(url);
  urlObj.searchParams.delete('page');
  return urlObj.toString();
}

export function getIdFromUrl(url: string) {
  const urlObj = new URL(url);
  return urlObj.pathname
    .split('/')
    .filter(Boolean)
    .slice(-1)[0];
}
