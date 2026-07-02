export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else if (seconds > 0) {
    return `${seconds}s ${ms % 1000}ms`;
  }
  return `${ms}ms`;
};
