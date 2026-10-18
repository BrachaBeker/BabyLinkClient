// כל ה-endpoints של השרת במקום אחד. כל פונקציה היא שורה אחת מעל apiRequest.
import { apiRequest } from './client'
import type {
  AuthResponse,
  LoginRequest,
  PagedResult,
  RegisterRequest,
  ServiceRequestBody,
  ServiceRequestDetails,
  ServiceRequestListItem,
  ServiceRequestQuery,
  Tag,
  UserDto,
} from './types'

export const babylinkApi = {
  // ---- Users & tokens ----
  register: (body: RegisterRequest) =>
    apiRequest<UserDto>('/api/users', { method: 'POST', body }),

  login: (body: LoginRequest) =>
    apiRequest<AuthResponse>('/api/tokens', { method: 'POST', body }),

  // ---- Service requests ----
  getRequests: (query: ServiceRequestQuery, signal?: AbortSignal) =>
    apiRequest<PagedResult<ServiceRequestListItem>>('/api/service-requests', { query, signal }),

  getRequest: (id: number, signal?: AbortSignal) =>
    apiRequest<ServiceRequestDetails>(`/api/service-requests/${id}`, { signal }),

  createRequest: (body: ServiceRequestBody) =>
    apiRequest<ServiceRequestDetails>('/api/service-requests', { method: 'POST', body }),

  updateRequest: (id: number, body: ServiceRequestBody) =>
    apiRequest<void>(`/api/service-requests/${id}`, { method: 'PUT', body }),

  deleteRequest: (id: number) =>
    apiRequest<void>(`/api/service-requests/${id}`, { method: 'DELETE' }),

  // תפיסת בקשה ע"י שמרטפית. בלי body. 409 = מישהי אחרת הקדימה.
  assignRequest: (id: number) =>
    apiRequest<ServiceRequestDetails>(`/api/service-requests/${id}/assignment`, { method: 'PUT' }),

  // ---- Tags ----
  getTags: (signal?: AbortSignal) => apiRequest<Tag[]>('/api/tags', { signal }),
}
