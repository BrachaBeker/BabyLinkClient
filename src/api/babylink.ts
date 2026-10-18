// כל ה-endpoints של השרת במקום אחד. כל פונקציה היא שורה אחת מעל apiRequest.
import { apiRequest } from './client'
import type {
  AuthResponse,
  LoginRequest,
  NotificationDto,
  PagedResult,
  RegisterRequest,
  ServiceRequestBody,
  ServiceRequestDetails,
  ServiceRequestListItem,
  ServiceRequestQuery,
  Tag,
  UpdateUserRequest,
  UserDto,
} from './types'

export const babylinkApi = {
  // ---- Users & tokens ----
  register: (body: RegisterRequest) =>
    apiRequest<UserDto>('/api/users', { method: 'POST', body }),

  login: (body: LoginRequest) =>
    apiRequest<AuthResponse>('/api/tokens', { method: 'POST', body }),

  // הפרופיל של המשתמש המחובר (השרת מחזיר רק את המשתמש עצמו)
  getUser: (id: number, signal?: AbortSignal) =>
    apiRequest<UserDto>(`/api/users/${id}`, { signal }),

  updateUser: (id: number, body: UpdateUserRequest) =>
    apiRequest<UserDto>(`/api/users/${id}`, { method: 'PUT', body }),

  // ---- Service requests ----
  getRequests: (query: ServiceRequestQuery, signal?: AbortSignal) =>
    apiRequest<PagedResult<ServiceRequestListItem>>('/api/service-requests', { query, signal }),

  getRequest: (id: number, signal?: AbortSignal) =>
    apiRequest<ServiceRequestDetails>(`/api/service-requests/${id}`, { signal }),

  createRequest: (body: ServiceRequestBody) =>
    apiRequest<ServiceRequestDetails>('/api/service-requests', { method: 'POST', body }),

  updateRequest: (id: number, body: ServiceRequestBody) =>
    apiRequest<void>(`/api/service-requests/${id}`, { method: 'PUT', body }),

  // ביטול בקשה. אם היא כבר נתפסה - השמרטפית מקבלת הודעה.
  deleteRequest: (id: number) =>
    apiRequest<void>(`/api/service-requests/${id}`, { method: 'DELETE' }),

  // תפיסת בקשה ע"י שמרטפית. בלי body. 409 = מישהי אחרת הקדימה.
  assignRequest: (id: number) =>
    apiRequest<ServiceRequestDetails>(`/api/service-requests/${id}/assignment`, { method: 'PUT' }),

  // ---- Tags ----
  getTags: (signal?: AbortSignal) => apiRequest<Tag[]>('/api/tags', { signal }),

  // ---- Notifications ----
  getNotifications: (signal?: AbortSignal) =>
    apiRequest<NotificationDto[]>('/api/notifications', { signal }),

  dismissNotification: (id: number) =>
    apiRequest<void>(`/api/notifications/${id}`, { method: 'DELETE' }),

  dismissAllNotifications: () =>
    apiRequest<void>('/api/notifications', { method: 'DELETE' }),
}
