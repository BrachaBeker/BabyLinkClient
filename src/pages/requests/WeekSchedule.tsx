// לוח השיבוצים של השמרטפית: 7 הימים הקרובים, וכל יום עם השיבוצים שלו.
// "הצג עוד" טוען את כל השיבוצים העתידיים ומציג את כל הלוח (עד השיבוץ האחרון) בתוך אזור גלילה.
// הנתונים מאותו GET /api/service-requests, עם mine ו-toUtc (טווח השבוע). הלוח מתעדכן חי (Polling).
import { CalendarDays, ChevronDown, ChevronUp, Coffee } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { babylinkApi } from '../../api/babylink'
import { isApiError } from '../../api/client'
import type { ServiceRequestListItem } from '../../api/types'
import Alert from '../../components/Alert'
import { Spinner } from '../../components/Loading'
import { LIVE_REFRESH_MS, sameData, usePolling } from '../../hooks/usePolling'
import {
  addDays,
  childrenLabel,
  formatCurrency,
  formatDayMonth,
  formatRelativeDay,
  formatTimeRange,
  localDayKey,
  startOfLocalDay,
  totalEarnings,
} from '../../utils/format'

const WEEK_DAYS = 7
const PAGE_SIZE = 50
const MAX_PAGES = 10

// כל השיבוצים העתידיים, עמוד אחרי עמוד
async function loadAllAssignments(signal?: AbortSignal) {
  const all: ServiceRequestListItem[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await babylinkApi.getRequests({ mine: true, sortBy: 'startTime', page, pageSize: PAGE_SIZE }, signal)
    all.push(...result.items)
    if (page >= result.totalPages) break
  }
  return all
}

function loadWeek(signal?: AbortSignal) {
  const weekEnd = addDays(startOfLocalDay(new Date()), WEEK_DAYS)
  return babylinkApi
    .getRequests({ mine: true, toUtc: weekEnd.toISOString(), sortBy: 'startTime', pageSize: PAGE_SIZE }, signal)
    .then((result) => result.items)
}

export default function WeekSchedule() {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<ServiceRequestListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    ;(expanded ? loadAllAssignments(controller.signal) : loadWeek(controller.signal))
      .then((list) => {
        setItems(list)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(isApiError(err) ? err.message : 'לא ניתן לטעון את הלוח.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [expanded])

  // עדכון חי: אותה טעינה כל 10 שניות, בשקט. אם בינתיים עברו בין "השבוע" ל"כל הלוח" - מתעלמים מהתשובה הישנה.
  const expandedRef = useRef(expanded)
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])
  usePolling(
    async () => {
      const wasExpanded = expandedRef.current
      const list = await (wasExpanded ? loadAllAssignments() : loadWeek())
      if (wasExpanded !== expandedRef.current) return
      setItems((prev) => (sameData(prev, list) ? prev : list))
    },
    LIVE_REFRESH_MS,
    !loading && !error,
  )

  // קיבוץ השיבוצים לפי יום (בשעון המקומי)
  const byDay = new Map<string, ServiceRequestListItem[]>()
  for (const item of items ?? []) {
    const key = localDayKey(new Date(item.startTimeUtc))
    byDay.set(key, [...(byDay.get(key) ?? []), item])
  }

  // הימים שמוצגים: שבוע מהיום, ובתצוגה המלאה - עד היום של השיבוץ האחרון
  const today = startOfLocalDay(new Date())
  let dayCount = WEEK_DAYS
  if (expanded && items && items.length > 0) {
    const last = startOfLocalDay(new Date(items[items.length - 1].startTimeUtc))
    dayCount = Math.max(WEEK_DAYS, Math.round((last.getTime() - today.getTime()) / 864e5) + 1)
  }
  const days = Array.from({ length: dayCount }, (_, i) => addDays(today, i))

  const total = (items ?? []).reduce((sum, i) => sum + totalEarnings(i.hourlyRate, i.startTimeUtc, i.endTimeUtc), 0)
  const hasMoreBeyondWeek = expanded && dayCount > WEEK_DAYS

  return (
    <section className="card schedule" aria-label="לוח השיבוצים">
      <div className="schedule-head">
        <h2 className="card-title">
          <CalendarDays size={18} />
          {expanded ? 'כל השיבוצים הקרובים' : 'השבוע הקרוב'}
        </h2>
        {items && items.length > 0 && (
          <span className="schedule-sum">
            {items.length === 1 ? 'שיבוץ אחד' : `${items.length} שיבוצים`} · {formatCurrency(total)}
          </span>
        )}
        {loading && <Spinner />}
      </div>

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <div className={`schedule-days ${expanded ? 'is-expanded' : ''} ${loading ? 'is-loading' : ''}`}>
          {days.map((day) => {
            const dayItems = byDay.get(localDayKey(day)) ?? []
            const isToday = day.getTime() === today.getTime()
            return (
              <div key={day.getTime()} className={`schedule-day ${isToday ? 'today' : ''} ${dayItems.length === 0 ? 'free' : ''}`}>
                <div className="schedule-date">
                  <strong>{formatRelativeDay(day.toISOString())}</strong>
                  <span>{formatDayMonth(day)}</span>
                </div>
                <div className="schedule-slots">
                  {dayItems.length === 0 ? (
                    <span className="schedule-free">
                      <Coffee size={14} />
                      אין שיבוצים
                    </span>
                  ) : (
                    dayItems.map((item) => (
                      <Link key={item.id} to={`/requests/${item.id}`} className="schedule-slot">
                        <span className="slot-time">{formatTimeRange(item.startTimeUtc, item.endTimeUtc)}</span>
                        <span className="slot-place">
                          {item.street}, {item.city}
                        </span>
                        <span className="slot-meta">
                          {childrenLabel(item.childrenCount)} ·{' '}
                          {formatCurrency(totalEarnings(item.hourlyRate, item.startTimeUtc, item.endTimeUtc))}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )
          })}
          {expanded && !loading && !hasMoreBeyondWeek && (
            <p className="schedule-end">אין שיבוצים נוספים אחרי השבוע הקרוב.</p>
          )}
        </div>
      )}

      <button type="button" className="btn btn-secondary btn-block schedule-toggle" onClick={() => setExpanded((e) => !e)}>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {expanded ? 'הצג פחות' : 'הצג עוד'}
      </button>
    </section>
  )
}
