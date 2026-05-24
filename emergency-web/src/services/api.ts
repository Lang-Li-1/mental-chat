import { createApiClient, createLocalStorageAdapter } from '@mental-chat/shared'
import type { CrisisAlert, PaginatedResponse } from '../types/crisis'
import { toChineseErrorMessage } from '../utils/errorMessage'

const apiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,
  storage: createLocalStorageAdapter(),
  accessTokenKey: 'emergency_token',
  refreshTokenKey: 'emergency_refresh_token',
  onAuthFailure: () => {
    window.dispatchEvent(new Event('emergency-logout'))
  },
})

export async function loginEmergency(username: string, password: string): Promise<void> {
  const response = await apiClient.post('/api/auth/login', { username, password })
  const { tokens, user } = response.data
  if (user.role !== 'admin' && user.role !== 'professional') {
    throw new Error(toChineseErrorMessage('Only admin or professional accounts can access the emergency dashboard.'))
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
