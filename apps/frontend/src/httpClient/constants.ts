import { env } from '../config/env';

export const baseURL = env.isDev
  ? 'http://localhost:8080'
  : window.location.origin;
export const sseURL = `${baseURL}/api/sse`;
