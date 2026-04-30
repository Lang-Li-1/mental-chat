import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

export interface TokenStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  storage: TokenStorage;
  accessTokenKey?: string;
  refreshTokenKey?: string;
  refreshEndpoint?: string;
  onAuthFailure?: () => void | Promise<void>;
}

export function createApiClient(config: ApiClientConfig): AxiosInstance {
  const {
    baseURL,
    timeout = 15000,
    storage,
    accessTokenKey = 'access_token',
    refreshTokenKey = 'refresh_token',
    refreshEndpoint = '/api/auth/token/refresh',
    onAuthFailure,
  } = config;

  const client = axios.create({
    baseURL,
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(async (req) => {
    const token = await storage.getItem(accessTokenKey);
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
  });

  let isRefreshing = false;
  let pending: Array<(token: string) => void> = [];

  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const req = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;

      if (error.response?.status === 401 && req && !req._retry) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            pending.push((token) => {
              req.headers.Authorization = `Bearer ${token}`;
              resolve(client(req));
            });
          });
        }

        req._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = await storage.getItem(refreshTokenKey);
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post(`${baseURL}${refreshEndpoint}`, {
            refresh: refreshToken,
          });

          await storage.setItem(accessTokenKey, data.access);
          if (data.refresh) await storage.setItem(refreshTokenKey, data.refresh);

          pending.forEach((cb) => cb(data.access));
          pending = [];

          req.headers.Authorization = `Bearer ${data.access}`;
          return client(req);
        } catch {
          pending = [];
          await storage.removeItem(accessTokenKey);
          await storage.removeItem(refreshTokenKey);
          await onAuthFailure?.();
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export function createLocalStorageAdapter(): TokenStorage {
  const hasLS = typeof localStorage !== 'undefined';
  return {
    getItem: (k) => (hasLS ? localStorage.getItem(k) : null),
    setItem: (k, v) => {
      if (hasLS) localStorage.setItem(k, v);
    },
    removeItem: (k) => {
      if (hasLS) localStorage.removeItem(k);
    },
  };
}
