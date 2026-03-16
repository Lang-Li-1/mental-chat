import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

// ── Axios instance with base URL and auth interceptor ───────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach JWT token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 — try refresh token first, then logout if that also fails
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE_URL}/api/auth/token/refresh`, {
          refresh: refreshToken,
        });

        await AsyncStorage.setItem('access_token', data.access);
        if (data.refresh) {
          await AsyncStorage.setItem('refresh_token', data.refresh);
        }

        // Retry queued requests
        pendingRequests.forEach((cb) => cb(data.access));
        pendingRequests = [];

        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch {
        // Refresh also failed — force logout
        pendingRequests = [];
        await AsyncStorage.removeItem('access_token');
        await AsyncStorage.removeItem('refresh_token');
        await AsyncStorage.removeItem('user_info');
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth API ────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: string;
}

export interface AuthResponse {
  user: UserInfo;
  tokens: {
    refresh: string;
    access: string;
  };
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
}

export const authAPI = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/api/auth/login', data),

  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/api/auth/register', data),
};

// ── User API ────────────────────────────────────────────────────────────────

export const userAPI = {
  getMe: () => api.get<UserInfo>('/api/users/me'),
  deleteAccount: () => api.delete('/api/users/delete_account'),
};

// ── Mood Entry API ──────────────────────────────────────────────────────────

export interface MoodEntry {
  id: number;
  user: number;
  mood_score: number;
  content: string;
  created_at: string;
}

export interface CreateMoodEntryRequest {
  mood_score: number;
  content: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const moodAPI = {
  list: () =>
    api.get<PaginatedResponse<MoodEntry>>('/api/mood_entries').then((res) => ({
      ...res,
      data: res.data.results,
    })),

  create: (data: CreateMoodEntryRequest) =>
    api.post<MoodEntry>('/api/mood_entries', data),
};

// ── Chat API ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  user: number;
  content: string;
  is_ai_response: boolean;
  session_id: string;
  created_at: string;
}

export interface SendMessageRequest {
  content: string;
  session_id?: string;
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  ai_message: ChatMessage;
  ai_error?: string;
}

export interface ChatSession {
  session_id: string;
  last_message_at: string;
  message_count: number;
  preview: string;
}

export const chatAPI = {
  sendMessage: (data: SendMessageRequest) =>
    api.post<SendMessageResponse>('/api/chat/send_message', data),

  getSessions: () =>
    api.get<ChatSession[]>('/api/chat/sessions'),

  getSessionMessages: (sessionId: string) =>
    api.get<ChatMessage[]>(`/api/chat/sessions/${sessionId}/messages`),

  sendMessageStream: async (
    data: SendMessageRequest,
    onMeta: (userMessage: ChatMessage) => void,
    onDelta: (text: string) => void,
    onDone: (aiMessage: ChatMessage) => void,
  ) => {
    const token = await AsyncStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/api/chat/send_message_stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const chunk = JSON.parse(payload);
          if (chunk.type === 'meta') onMeta(chunk.user_message);
          else if (chunk.type === 'delta') onDelta(chunk.text);
          else if (chunk.type === 'done') onDone(chunk.ai_message);
        } catch {}
      }
    }
  },
};

// ── Chat Feedback API ───────────────────────────────────────────────────────

export const chatFeedbackAPI = {
  submit: (messageId: number, isPositive: boolean) =>
    api.post(`/api/chat/messages/${messageId}/feedback`, { is_positive: isPositive }),
};

// ── Crisis Alert API ────────────────────────────────────────────────────────

export interface CrisisAlert {
  id: number;
  user: number;
  level: string;
  location: string;
  status: string;
  description: string;
  created_at: string;
}

export interface CreateCrisisAlertRequest {
  user: number;
  level: string;
  description: string;
  location?: string;
}

export const crisisAPI = {
  create: (data: CreateCrisisAlertRequest) =>
    api.post<CrisisAlert>('/api/crisis_alerts', data),
};

// ── Assessment API ──────────────────────────────────────────────────────────

export interface AssessmentResult {
  id: number;
  user: number;
  assessment_type: 'phq9' | 'gad7';
  total_score: number;
  answers: number[];
  severity: string;
  created_at: string;
}

export interface CreateAssessmentRequest {
  assessment_type: 'phq9' | 'gad7';
  total_score: number;
  answers: number[];
  severity: string;
}

export const assessmentAPI = {
  list: (type?: string) => {
    const params = type ? { type } : {};
    return api.get<AssessmentResult[]>('/api/assessments', { params });
  },
  create: (data: CreateAssessmentRequest) =>
    api.post<AssessmentResult>('/api/assessments', data),
};

// ── Recovery Plan API ───────────────────────────────────────────────────────

export interface RecoveryTask {
  id: number;
  user: number;
  task_type: string;
  title: string;
  description: string;
  is_completed: boolean;
  date: string;
  completed_at: string | null;
  created_at: string;
}

export interface RecoveryBadge {
  id: number;
  user: number;
  badge_type: string;
  earned_at: string;
}

export interface RecoveryStats {
  total_completed: number;
  total_tasks: number;
  current_streak: number;
  badge_count: number;
}

export const recoveryAPI = {
  getTasks: (date?: string) => {
    const params = date ? { date } : {};
    return api.get<RecoveryTask[]>('/api/recovery/tasks', { params });
  },
  completeTask: (taskId: number) =>
    api.post<RecoveryTask>(`/api/recovery/tasks/${taskId}/complete`),
  getBadges: () =>
    api.get<RecoveryBadge[]>('/api/recovery/badges'),
  getStats: () =>
    api.get<RecoveryStats>('/api/recovery/stats'),
};

// ── Supporter API ───────────────────────────────────────────────────────────

export interface SupporterLink {
  id: number;
  supporter: UserInfo;
  patient: UserInfo;
  created_at: string;
}

export interface EncouragementMessage {
  id: number;
  sender: number;
  receiver: number;
  content: string;
  is_read: boolean;
  sender_name: string;
  created_at: string;
}

export const supporterAPI = {
  getLinkedPatients: () =>
    api.get<SupporterLink[]>('/api/supporter/linked_patients'),

  linkPatient: (identifier: string) =>
    api.post<SupporterLink>('/api/supporter/link_patient', { identifier }),

  sendEncouragement: (receiverId: number, content: string) =>
    api.post<EncouragementMessage>('/api/supporter/send_encouragement', {
      receiver_id: receiverId,
      content,
    }),
};

export const encouragementAPI = {
  list: () =>
    api.get<EncouragementMessage[]>('/api/encouragements'),

  unreadCount: () =>
    api.get<{ count: number }>('/api/encouragements/unread_count'),
};

// ── Patient Status API ──────────────────────────────────────────────────────

export interface PatientStatusSummary {
  user: UserInfo;
  recent_mood_entries: MoodEntry[];
  average_mood_score: number | null;
  total_chat_messages: number;
  active_crisis_alerts: number;
}

export const patientStatusAPI = {
  getSummary: (patientId: number) =>
    api.get<PatientStatusSummary>(`/api/patients/${patientId}/status_summary`),
};

// ── Article API ──────────────────────────────────────────────────────────────

export interface ArticleItem {
  id: number;
  title: string;
  summary: string;
  content: string;
  url: string;
  category: string;
  author_name: string;
  created_at: string;
}

export const articleAPI = {
  list: (category?: string) => {
    const params = category ? { category } : {};
    return api.get<ArticleItem[]>('/api/articles', { params });
  },
  get: (id: number) =>
    api.get<ArticleItem>(`/api/articles/${id}`),
};

// ── TTS API ──────────────────────────────────────────────────────────────────

export const ttsAPI = {
  speak: (text: string) =>
    api.post('/api/tts', { text }, { responseType: 'blob' }),
};

export default api;
