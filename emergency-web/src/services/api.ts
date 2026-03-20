import axios from 'axios'
import type { CrisisAlert, PaginatedResponse } from '../types/crisis'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Phase 1.3: JWT token interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('emergency_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Handle 401 — try refresh, then redirect to login
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem('emergency_refresh_token')
        if (!refreshToken) throw new Error('No refresh token')

        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
        const { data } = await axios.post(`${baseURL}/api/auth/token/refresh`, {
          refresh: refreshToken,
        })

        localStorage.setItem('emergency_token', data.access)
        if (data.refresh) localStorage.setItem('emergency_refresh_token', data.refresh)

        pendingRequests.forEach((cb) => cb(data.access))
        pendingRequests = []

        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return apiClient(originalRequest)
      } catch {
        pendingRequests = []
        localStorage.removeItem('emergency_token')
        localStorage.removeItem('emergency_refresh_token')
        // Dispatch event so App.vue can show login
        window.dispatchEvent(new Event('emergency-logout'))
      } finally {
        isRefreshing = false
      }
    }
    console.error('[API Error]', error.message)
    return Promise.reject(error)
  }
)

export async function loginEmergency(username: string, password: string): Promise<void> {
  const response = await apiClient.post('/api/auth/login', { username, password })
  const { tokens, user } = response.data
  if (user.role !== 'admin' && user.role !== 'professional') {
    throw new Error('Only admin or professional accounts can access the emergency dashboard.')
  }
  localStorage.setItem('emergency_token', tokens.access)
  localStorage.setItem('emergency_refresh_token', tokens.refresh)
}

export function logoutEmergency(): void {
  localStorage.removeItem('emergency_token')
  localStorage.removeItem('emergency_refresh_token')
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('emergency_token')
}

export async function fetchActiveCrisisAlerts(): Promise<CrisisAlert[]> {
  const response = await apiClient.get<PaginatedResponse<CrisisAlert>>('/api/crisis_alerts/active')
  return response.data.results
}

export async function updateAlertStatus(
  id: number,
  status: 'acknowledged' | 'resolved',
  notes?: string,
): Promise<CrisisAlert> {
  const response = await apiClient.patch<CrisisAlert>(`/api/crisis_alerts/${id}/status`, {
    status,
    notes: notes || '',
  })
  return response.data
}

export default apiClient
