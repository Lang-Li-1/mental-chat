import { createApiClient, createLocalStorageAdapter } from '@mental-chat/shared';

const api = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 15000,
  storage: createLocalStorageAdapter(),
  accessTokenKey: 'token',
  refreshTokenKey: 'refresh_token',
  onAuthFailure: () => {
    const loginPath = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/login`;
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
  },
});

export default api;
