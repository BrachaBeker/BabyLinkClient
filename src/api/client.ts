// לב שכבת ה-API: פונקציה אחת (apiRequest) שכל הקריאות לשרת עוברות דרכה.
// היא מוסיפה את כתובת השרת מ-VITE_API_URL, את ה-JWT (Authorization: Bearer) ואת ה-headers,
// ומתרגמת כל תשובת שגיאה (ProblemDetails) ל-ApiError אחיד שהמסכים יודעים להציג.
import type { ProblemDetails } from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

// ---------- Token storage ----------

const TOKEN_KEY = 'babylink.token'

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// ה-AuthContext נרשם כאן, כדי ש-401 מכל מקום באפליקציה ינתק את המשתמש.
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

// ---------- Errors ----------

export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails | null

  constructor(status: number, message: string, problem: ProblemDetails | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  // שגיאות ולידציה לפי שדה: { city: 'שדה חובה', ... } (מפתחות ב-camelCase כמו בטופס).
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, messages] of Object.entries(this.problem?.errors ?? {})) {
      const field = normalizeFieldName(key)
      if (field && messages.length > 0) result[field] = translateValidationMessage(messages[0])
    }
    return result
  }
}

// "City" -> "city", "$.startTimeUtc" -> "startTimeUtc", "TagIds[0]" -> "tagIds"
function normalizeFieldName(key: string): string {
  const clean = key.replace(/^\$\.?/, '').replace(/\[\d+\]/g, '').split('.').pop() ?? ''
  return clean.charAt(0).toLowerCase() + clean.slice(1)
}

// הודעות הוולידציה האוטומטיות של ASP.NET חוזרות באנגלית - מתרגמים את התבניות המוכרות.
function translateValidationMessage(message: string): string {
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/is required/i, () => 'שדה חובה'],
    [/not a valid e-?mail/i, () => 'כתובת אימייל לא תקינה'],
    [/not a valid phone/i, () => 'מספר טלפון לא תקין'],
    [/minimum length of '(\d+)'/i, (m) => `לפחות ${m[1]} תווים`],
    [/maximum length of '(\d+)'/i, (m) => `עד ${m[1]} תווים`],
    [/must be between (\S+) and (\S+?)\.?$/i, (m) => `ערך בין ${m[1]} ל-${m[2]}`],
    [/could not be converted|is not valid|invalid/i, () => 'ערך לא תקין'],
  ]
  for (const [pattern, translate] of rules) {
    const match = message.match(pattern)
    if (match) return translate(match)
  }
  return message
}

const DEFAULT_MESSAGES: Record<number, string> = {
  // אין תשובה מהשרת - בדרך כלל השרת החינמי ב-Render מתעורר, לא בעיה בחיבור של המשתמש
  0: 'השרת מתעורר, נסו שוב בעוד רגע.',
  400: 'יש שגיאות בנתונים. בדקו את השדות המסומנים.',
  401: 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  403: 'אין לך הרשאה לבצע את הפעולה הזו.',
  404: 'הפריט המבוקש לא נמצא.',
  409: 'הפעולה התנגשה עם שינוי אחר שבוצע בינתיים.',
  500: 'אירעה שגיאה בשרת. נסו שוב בעוד רגע.',
}

function defaultMessage(status: number) {
  return DEFAULT_MESSAGES[status] ?? (status >= 500 ? DEFAULT_MESSAGES[500] : 'אירעה שגיאה. נסו שוב.')
}

// ---------- Request ----------

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: object
  signal?: AbortSignal
}

function buildUrl(path: string, query?: object) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries((query ?? {}) as Record<string, QueryValue>)) {
    // לא שולחים פרמטרים ריקים או false - כך ה-URL נקי והשרת משתמש בברירת המחדל.
    if (value === undefined || value === null || value === '' || value === false) continue
    params.append(key, String(value))
  }
  const qs = params.toString()
  return `${API_URL}${path}${qs ? `?${qs}` : ''}`
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options
  const token = tokenStorage.get()

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, defaultMessage(0))
  }

  const data = await readBody(response)

  if (response.ok) return data as T

  const problem = data && typeof data === 'object' ? (data as ProblemDetails) : null

  // 401 על בקשה שנשלחה עם token = ה-token לא תקף. מנתקים, וה-ProtectedRoute יעביר למסך ההתחברות.
  // (401 בהתחברות עצמה - בלי token - הוא פשוט "אימייל או סיסמה שגויים", ולא מנתקים.)
  if (response.status === 401 && token) {
    tokenStorage.clear()
    unauthorizedHandler?.()
  }

  const message =
    response.status === 400 && problem?.errors
      ? defaultMessage(400)
      : problem?.detail || defaultMessage(response.status)

  throw new ApiError(response.status, message, problem)
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
