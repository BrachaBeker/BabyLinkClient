// טיפוסים לפי חוזה ה-API של BabyLink (JSON ב-camelCase, enums כמחרוזת, זמנים ב-UTC כ-ISO 8601).

export type UserRole = 'Parent' | 'Babysitter'

export interface UserDto {
  id: number
  email: string
  fullName: string
  phone: string
  city: string
  street: string | null
  houseNumber: string | null
  role: UserRole
}

// רחוב ומספר בית - חובה להורה בלבד (לשמרטפית השרת לא שומר אותם)
export interface RegisterRequest {
  email: string
  password: string
  fullName: string
  phone: string
  city: string
  street?: string | null
  houseNumber?: string | null
  role: UserRole
}

// עדכון פרופיל (PUT /api/users/{id}) - בלי אימייל, סיסמה ותפקיד
export interface UpdateUserRequest {
  fullName: string
  phone: string
  city: string
  street?: string | null
  houseNumber?: string | null
}

// RequestCancelled - ההורה ביטל בקשה שתפסת (לשמרטפית)
// RequestAssigned - שמרטפית תפסה את הבקשה שלך (להורה)
// AssignmentCancelled - השמרטפית ביטלה את השיבוץ (להורה)
export type NotificationType = 'RequestCancelled' | 'RequestAssigned' | 'AssignmentCancelled'

// הודעה למשתמש. פרטי הבקשה שמורים בהודעה, כי בקשה שבוטלה כבר נמחקה.
export interface NotificationDto {
  id: number
  type: NotificationType
  // לקישור לפרטי הבקשה (null אם הבקשה כבר נמחקה)
  requestId: number | null
  requestStartTimeUtc: string
  requestEndTimeUtc: string
  city: string
  street: string
  houseNumber: string
  // מי ביצע את הפעולה: ההורה שביטל, או השמרטפית שתפסה / ביטלה
  actorFullName: string
  createdAtUtc: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  userId: number
  fullName: string
  role: UserRole
}

export interface Tag {
  id: number
  name: string
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface ServiceRequestListItem {
  id: number
  startTimeUtc: string
  endTimeUtc: string
  city: string
  street: string
  childrenCount: number
  hourlyRate: number
  tagNames: string[]
  isAssigned: boolean
  isExpired: boolean
}

export interface ServiceRequestDetails {
  id: number
  startTimeUtc: string
  endTimeUtc: string
  city: string
  street: string
  houseNumber: string
  addressNotes: string | null
  childrenCount: number
  hourlyRate: number
  description: string | null
  createdAtUtc: string
  parentId: number
  parentFullName: string
  parentPhone: string
  assignedBabysitterId: number | null
  assignedBabysitterFullName: string | null
  assignedBabysitterPhone: string | null
  assignedAtUtc: string | null
  tags: Tag[]
  isAssigned: boolean
  isExpired: boolean
}

// גוף הבקשה ליצירה (POST) ולעריכה (PUT) - אותם שדות.
export interface ServiceRequestBody {
  startTimeUtc: string
  endTimeUtc: string
  city: string
  street: string
  houseNumber: string
  addressNotes?: string | null
  childrenCount: number
  hourlyRate: number
  description?: string | null
  tagIds: number[]
}

export type SortBy = 'startTime' | 'hourlyRate'

// open - ממתינה לשמרטפית, assigned - שובצה ועוד לא התחילה, past - מועדה עבר
export type RequestStatus = 'open' | 'assigned' | 'past'

export interface ServiceRequestQuery {
  status?: RequestStatus
  city?: string
  street?: string
  fromUtc?: string
  toUtc?: string
  tagId?: number
  minHourlyRate?: number
  onlyAvailable?: boolean
  mine?: boolean
  includePast?: boolean
  sortBy?: SortBy
  descending?: boolean
  page?: number
  pageSize?: number
}

// מבנה השגיאה שהשרת מחזיר (RFC 9457). ב-400 של ולידציה יש גם errors.
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  correlationId?: string
  errors?: Record<string, string[]>
}
