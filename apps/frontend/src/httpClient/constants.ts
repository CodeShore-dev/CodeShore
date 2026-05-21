export const baseURL = import.meta.env.DEV
  ? 'http://localhost:8080'
  : window.location.origin;
export const sseURL = `${baseURL}/api/sse`;
