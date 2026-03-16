export interface CrisisAlert {
  id: number
  user: number
  level: 'high' | 'medium' | 'low' | 'critical'
  location: string
  status: string
  description: string
  handled_by: number | null
  handled_by_name: string | null
  created_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
