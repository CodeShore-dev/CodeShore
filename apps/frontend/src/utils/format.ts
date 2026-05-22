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
  return (n / 10000).toFixed(0);
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
) => {
  const now = dayjs();
  const dayjsObj = date;
  const diffDays = now.diff(dayjsObj, 'days');
  const diffHours = now.diff(dayjsObj, 'hours');
  const diffMinutes = now.diff(dayjsObj, 'minutes');
  if (diffDays > 0) {
    if (diffDays > 10) {
      return '重爬於 ' + formattedDate;
    }
    return diffDays + ' 天前重爬';
  } else if (diffHours > 0) {
    return diffHours + ' 小時前重爬';
  } else if (diffMinutes > 60) {
    return diffMinutes + '分鐘前重爬';
  }
  return '幾秒前重爬';
};

