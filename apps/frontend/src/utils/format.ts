import dayjs from 'dayjs';

export const toWan = (
  n: number | null | undefined,
): string => {
  if (n == null) return '—';
  return (n / 10000).toFixed(n % 10000 ? 1 : 0) + '萬';
};

export const toWanInt = (
  n: number | null | undefined,
): string => {
  if (n == null) return '—';
  return (n / 10000).toFixed(n % 10000 ? 1 : 0);
};

export const formatNumber = (
  value: number | string,
): string => {
  const num =
    typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });
};

export const formatDateInfo = (
  date: dayjs.Dayjs,
  formattedDate: string,
  action = '重爬',
) => {
  const now = dayjs();
  const diffDays = now.diff(date, 'days');
  const diffHours = now.diff(date, 'hours');
  const diffMinutes = now.diff(date, 'minutes');
  if (diffDays > 0) {
    if (diffDays > 10) return action + '於 ' + formattedDate;
    return diffDays + ` 天前${action}`;
  } else if (diffHours > 0) {
    return diffHours + ` 小時前${action}`;
  } else if (diffMinutes > 60) {
    return diffMinutes + `分鐘前${action}`;
  }
  return `幾秒前${action}`;
};

