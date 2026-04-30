// Auto-switch between local dev and production.
// __DEV__ is a Metro/RN global: true in `expo start`, false in release builds.
// Override at runtime by setting EXPO_PUBLIC_API_BASE_URL in your shell or .env.

const PROD_API = 'http://47.239.219.238';
const DEV_API = 'http://localhost:8000';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? (__DEV__ ? DEV_API : PROD_API);
