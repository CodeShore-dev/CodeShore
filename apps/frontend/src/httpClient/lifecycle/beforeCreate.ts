export default () => {
  if (import.meta.env.DEV) {
    const queryRecord = parseQueryString();
    const token = <string>queryRecord.token ?? '';
    const appList = queryRecord.appList ?? [];
    if (token && Array.isArray(appList)) {
      setLocalStorage(token, appList);
      const href = `${window.location.origin}${window.location.pathname}`;
      window.location.replace(href);
    }
  }
};

/**
 * if window.location.search is
 * '?token=my-token&appList=[{%22code%22:%22my-code%22}]'
 * @returns {Object} { token: 'my-token', appList: [{ code: "my-code" }] }
 */
export const parseQueryString = <
  T = Record<string, unknown>,
>(
  url?: string,
): T =>
  (url ?? window.location.search)
    .replace(/^https?:\/\/.*?(\?|$)/, '?')
    .slice(1)
    .split('&')
    .map(pair => pair.split('='))
    .reduce(
      (prev, curr) => {
        const [key, value] = curr;
        if (key && value) {
          let newValue;
          let newKey = decodeURIComponent(key);
          try {
            newValue = decodeURIComponent(value);
            newValue = JSON.parse(newValue);
          } catch (error) {
            newValue = value;
          }
          prev[newKey] = newValue;
        }
        return prev;
      },
      {} as Record<string, unknown>,
    ) as T;

export const setLocalStorage = (
  token: string,
  appList: unknown[],
) => {
  const userInfo = {
    src: '',
    account: 'local.host@yitmh.com',
    email: 'local.host@yitmh.com',
    first_name: 'Local',
    last_name: 'Host',
    business_unit: 'YT-CWD',
    type: 'user',
    exp: 1642173203,
    iss: 'XYCloud',
    sub: 'local.host@yitmh.com',
  };

  const authInfo = {};

  localStorage.setItem(
    'userInfo',
    JSON.stringify(userInfo),
  );
  localStorage.setItem('token', token);
  localStorage.setItem('appList', JSON.stringify(appList));
  localStorage.setItem(
    'authInfo',
    JSON.stringify(authInfo),
  );
};
