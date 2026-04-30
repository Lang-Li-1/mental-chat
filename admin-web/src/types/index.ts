export interface Patient {
  id: number;
  username: string;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
}

export interface PatientAssignment {
  id: number;
  patient: Patient;
  professional: number;
  created_at: string;
}

export type { PaginatedResponse } from '@mental-chat/shared';

export interface MoodEntry {
  id: number;
  user: number;
  mood_score: number;
  content: string;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: Patient;
  tokens: {
    access: string;
    refresh: string;
  };
}

export interface CrisisAlert {
  id: number;
  user: number;
  level: 'high' | 'medium' | 'low' | 'critical';
  location: string;
  status: string;
  description: string;
  handled_by: number | null;
  handled_by_name: string | null;
  processing_notes: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface Assignment {
  id: number;
  patient: Patient;
  professional: Patient;
  created_at: string;
}
