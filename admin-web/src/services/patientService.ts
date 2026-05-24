import api from './api';
import type { LoginRequest, LoginResponse, Patient, PatientAssignment, PaginatedResponse, MoodEntry, CrisisAlert, Assignment } from '../types';
import { toChineseErrorMessage } from '../utils/errorMessage';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/login', data);
  return response.data;
}

export async function registerProfessional(data: {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/register_professional', data);
  return response.data;
}

export async function getPatients(): Promise<Patient[]> {
  const response = await api.get<PaginatedResponse<PatientAssignment>>('/api/patients');
  return response.data.results.map((assignment) => assignment.patient);
}

export async function getPatient(id: string): Promise<Patient> {
  const role = localStorage.getItem('userRole');
  if (role === 'admin') {
    // Admin: fetch from admin patients endpoint
    const patients = await getAllPatients();
    const patient = patients.find((p) => p.id === Number(id));
    if (!patient) throw new Error(toChineseErrorMessage('Patient not found'));
    return patient;
  }
  // Professional: fetch from assignments
  const response = await api.get<PaginatedResponse<PatientAssignment>>('/api/patients');
  const assignment = response.data.results.find((a) => a.patient.id === Number(id));
  if (!assignment) {
    throw new Error(toChineseErrorMessage('Patient not found'));
  }
  return assignment.patient;
}

export async function getMoodEntries(patientId: string): Promise<MoodEntry[]> {
  const response = await api.get<PaginatedResponse<MoodEntry>>('/api/mood_entries', {
    params: { patient_id: patientId },
  });
  return response.data.results;
}

// ── Patient Detail ──────────────────────────────────────────────────────────

export interface PatientDetail {
  user: Patient;
  mood_entries: MoodEntry[];
  average_mood_score: number | null;
  mood_trend: { date: string; avg_score: number; count: number }[];
  total_chat_messages: number;
  recent_sessions: { session_id: string; last_at: string; message_count: number; preview: string }[];
  crisis_alerts: CrisisAlert[];
  assessments: { id: number; assessment_type: string; total_score: number; severity: string; created_at: string }[];
}

export async function getPatientDetail(id: string): Promise<PatientDetail> {
  const response = await api.get<PatientDetail>(`/api/patients/${id}/detail`);
  return response.data;
}

// ── Admin APIs ────────────────────────────────────────────────────────────────

export async function getAllPatients(): Promise<Patient[]> {
  const response = await api.get<Patient[]>('/api/admin/patients');
  return response.data;
}

export async function getAllProfessionals(): Promise<Patient[]> {
  const response = await api.get<Patient[]>('/api/admin/professionals');
  return response.data;
}

export async function getAssignments(): Promise<Assignment[]> {
  const response = await api.get<Assignment[]>('/api/admin/assignments');
  return response.data;
}

export async function createAssignment(patientId: number, professionalId: number): Promise<Assignment> {
  const response = await api.post<Assignment>('/api/admin/assignments', {
    patient_id: patientId,
    professional_id: professionalId,
  });
  return response.data;
}

export async function deleteAssignment(id: number): Promise<void> {
  await api.delete(`/api/admin/assignments/${id}`);
}

// ── Admin: Users ─────────────────────────────────────────────────────────────

export async function getAdminUsers(params?: { role?: string; search?: string }): Promise<Patient[]> {
  const response = await api.get<Patient[]>('/api/admin/users', { params });
  return response.data;
}

export async function updateAdminUser(
  id: number,
  data: { is_active?: boolean; role?: string },
): Promise<Patient> {
  const response = await api.patch<Patient>(`/api/admin/users/${id}`, data);
  return response.data;
}

export async function createAdminUser(data: {
  username: string;
  password: string;
  role: 'admin' | 'professional';
  email?: string;
  phone?: string;
}): Promise<Patient> {
  const response = await api.post<Patient>('/api/admin/users', data);
  return response.data;
}

// ── Admin: Stats ─────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<{
  users: { total: number; patients: number; professionals: number; supporters: number };
  mood_entries: { total: number; last_7_days: number; last_30_days: number; average_score: number | null };
  chat_messages: { total: number; last_7_days: number };
  crisis_alerts: { total: number; active: number; resolved: number; last_7_days: number; last_30_days: number };
}> {
  const response = await api.get('/api/admin/stats');
  return response.data;
}

// ── CSV Export ────────────────────────────────────────────────────────────────

export async function exportCSV(type: 'patients' | 'mood_entries' | 'crisis_alerts'): Promise<void> {
  const response = await api.get(`/api/admin/export/${type}`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8-sig' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Articles ──────────────────────────────────────────────────────────────────

export interface Article {
  id: number;
  title: string;
  summary: string;
  content: string;
  url: string;
  category: string;
  author: number | null;
  author_name: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export async function getArticles(params?: { category?: string; search?: string }): Promise<Article[]> {
  const response = await api.get<Article[]>('/api/articles', { params });
  return response.data;
}

export async function createArticle(data: { title: string; summary: string; content: string; url?: string; category: string; is_published: boolean }): Promise<Article> {
  const response = await api.post<Article>('/api/articles', data);
  return response.data;
}

export async function updateArticle(id: number, data: Partial<{ title: string; summary: string; content: string; url: string; category: string; is_published: boolean }>): Promise<Article> {
  const response = await api.put<Article>(`/api/articles/${id}`, data);
  return response.data;
}

export async function parseArticleUrl(url: string): Promise<{ title: string; summary: string; content: string }> {
  const response = await api.post<{ title: string; summary: string; content: string }>('/api/articles/parse_url', { url });
  return response.data;
}

export async function deleteArticle(id: number): Promise<void> {
  await api.delete(`/api/articles/${id}`);
}

// ── Crisis Alerts ─────────────────────────────────────────────────────────────

export async function fetchActiveCrisisAlerts(): Promise<CrisisAlert[]> {
  const response = await api.get<PaginatedResponse<CrisisAlert>>('/api/crisis_alerts/active');
  return response.data.results;
}

export async function updateAlertStatus(
  id: number,
  newStatus: 'acknowledged' | 'resolved',
  notes?: string,
): Promise<CrisisAlert> {
  const response = await api.patch<CrisisAlert>(`/api/crisis_alerts/${id}/status`, {
    status: newStatus,
    notes: notes || '',
  });
  return response.data;
}

export async function fetchAllCrisisAlerts(params?: {
  level?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}): Promise<CrisisAlert[]> {
  const response = await api.get<PaginatedResponse<CrisisAlert>>('/api/crisis_alerts/all', { params });
  return response.data.results;
}

export async function fetchCrisisAlertStats(): Promise<{
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  last_7_days: number;
  last_30_days: number;
  avg_resolution_seconds: number | null;
}> {
  const response = await api.get('/api/crisis_alerts/stats');
  return response.data;
}
