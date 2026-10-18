// עזרי תצוגה. השרת עובד ב-UTC; כאן ממירים לשעון המקומי של הדפדפן (ולהפך בשליחה).
import type { UserRole } from '../api/types'

export function roleLabel(role: UserRole) {
  return role === 'Parent' ? 'הורה' : 'שמרטפית'
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
const shortDateFormatter = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
const dateTimeFormatter = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' })

export const formatDate = (iso: string) => dateFormatter.format(new Date(iso))
export const formatShortDate = (iso: string) => shortDateFormatter.format(new Date(iso))
export const formatTime = (iso: string) => timeFormatter.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso))

const dayNumberFormatter = new Intl.DateTimeFormat('he-IL', { day: 'numeric' })
const monthShortFormatter = new Intl.DateTimeFormat('he-IL', { month: 'short' })
const weekdayFormatter = new Intl.DateTimeFormat('he-IL', { weekday: 'long' })

export const formatDayNumber = (iso: string) => dayNumberFormatter.format(new Date(iso))
export const formatMonthShort = (iso: string) => monthShortFormatter.format(new Date(iso))

function isSameLocalDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

// "היום" / "מחר" / "יום שלישי"
export function formatRelativeDay(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (isSameLocalDay(date, today)) return 'היום'
  if (isSameLocalDay(date, tomorrow)) return 'מחר'
  return weekdayFormatter.format(date)
}

// "18:00 - 22:00", ואם המשמרת עוברת חצות: "22:00 - 06:00 (למחרת)"
export function formatTimeRange(startIso: string, endIso: string) {
  const sameDay = isSameLocalDay(new Date(startIso), new Date(endIso))
  return `${formatTime(startIso)} - ${formatTime(endIso)}${sameDay ? '' : ' (למחרת)'}`
}

export function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hoursText = hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`
  if (hours === 0) return `${rest} דקות`
  return rest ? `${hoursText} ו-${rest} דק'` : hoursText
}

// משך בין שני רגעים בניסוח קצר: "פחות מדקה", "8 דקות", "שעתיים", "3 ימים"
export function formatElapsed(fromIso: string, toIso: string) {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000))
  if (minutes < 1) return 'פחות מדקה'
  if (minutes < 60) return minutes === 1 ? 'דקה' : `${minutes} דקות`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`
  const days = Math.round(hours / 24)
  return days === 1 ? 'יום' : days === 2 ? 'יומיים' : `${days} ימים`
}

const currencyFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export const formatCurrency = (value: number) => currencyFormatter.format(value)

// סה"כ לבקשה = תעריף לשעה × משך בשעות (כולל חלקי שעה), מעוגל לאגורות.
export function totalEarnings(hourlyRate: number, startIso: string, endIso: string) {
  const hours = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000
  return Math.round(hourlyRate * hours * 100) / 100
}

export function childrenLabel(count: number) {
  return count === 1 ? 'ילד אחד' : `${count} ילדים`
}

// ---- datetime-local <-> UTC ----

// ISO ב-UTC -> "YYYY-MM-DDTHH:mm" בשעון המקומי (הפורמט ש-<input type="datetime-local"> מצפה לו)
export function toLocalInputValue(iso: string) {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ערך מקומי מה-input -> ISO ב-UTC לשליחה לשרת
export function localInputToUtc(value: string) {
  return new Date(value).toISOString()
}

// ---- לוח השבוע ----

const weekdayShortFormatter = new Intl.DateTimeFormat('he-IL', { weekday: 'short' })
const dayMonthFormatter = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' })

export const formatWeekdayShort = (date: Date) => weekdayShortFormatter.format(date)
export const formatDayMonth = (date: Date) => dayMonthFormatter.format(date)

// "מפתח" של יום בשעון המקומי - לקיבוץ שיבוצים לפי יום
export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function startOfLocalDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// "הרגע", "לפני 5 דקות", "לפני שעתיים"
export function formatTimeAgo(iso: string) {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000
  return minutes < 1 ? 'הרגע' : `לפני ${formatElapsed(iso, new Date().toISOString())}`
}

// "פרסום שוב" של בקשה שמועדה עבר: אותו יום בשבוע ואותה שעה, בשבוע הקרוב שעוד לא הגיע.
export function nextWeeklySlot(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  while (start.getTime() <= Date.now() + 60 * 60 * 1000) {
    start.setDate(start.getDate() + 7)
    end.setDate(end.getDate() + 7)
  }
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
