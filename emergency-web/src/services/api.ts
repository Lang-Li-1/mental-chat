import axios from 'axios'
import type { CrisisAlert, PaginatedResponse } from '../types/crisis'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.message)
    return Promise.reject(error)
  }
)

export async function fetchActiveCrisisAlerts(): Promise<CrisisAlert[]> {
  const response = await apiClient.get<PaginatedResponse<CrisisAlert>>('/api/crisis_alerts/active')
  return response.data.results
}

export async function updateAlertStatus(
  id: number,
  status: 'acknowledged' | 'resolved'
): Promise<CrisisAlert> {
  const response = await apiClient.patch<CrisisAlert>(`/api/crisis_alerts/${id}/status`, {
    status,
  })
  return response.data
}

export default apiClient
