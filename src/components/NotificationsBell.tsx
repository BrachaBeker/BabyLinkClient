// פעמון ההודעות בסרגל העליון: מספר ההודעות, ורשימה שנפתחת בלחיצה.
// בכניסה למערכת, אם יש הודעות - הרשימה נפתחת לבד (גם להורה וגם לשמרטפית).
// הפעמון מתעדכן חי (Polling); הודעה חדשה שמגיעה תוך כדי עבודה מנענעת את הפעמון במקום לפתוח חלונית.
import { Bell, CalendarX2, UserCheck, UserX, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { babylinkApi } from '../api/babylink'
import type { NotificationDto, NotificationType } from '../api/types'
import { sameData, usePolling } from '../hooks/usePolling'
import { formatDate, formatTimeAgo, formatTimeRange } from '../utils/format'

const BELL_REFRESH_MS = 15_000

function when(n: NotificationDto) {
  return (
    <>
      ל{formatDate(n.requestStartTimeUtc)},{' '}
      <span className="nowrap">{formatTimeRange(n.requestStartTimeUtc, n.requestEndTimeUtc)}</span>{' '}
      ב{n.street} {n.houseNumber}, {n.city}
    </>
  )
}

// לכל סוג הודעה: כותרת, אייקון, צבע ונוסח
const KINDS: Record<NotificationType, { title: string; Icon: LucideIcon; tone: string; text: (n: NotificationDto) => ReactNode }> = {
  RequestCancelled: {
    title: 'בקשה שתפסת בוטלה',
    Icon: CalendarX2,
    tone: 'danger',
    text: (n) => (
      <>
        הבקשה {when(n)} בוטלה על ידי ההורה ({n.actorFullName}).
      </>
    ),
  },
  RequestAssigned: {
    title: 'נמצאה שמרטפית!',
    Icon: UserCheck,
    tone: 'success',
    text: (n) => (
      <>
        {n.actorFullName} תפסה את הבקשה {when(n)}.
      </>
    ),
  },
  AssignmentCancelled: {
    title: 'השמרטפית ביטלה את השיבוץ',
    Icon: UserX,
    tone: 'warning',
    text: (n) => (
      <>
        {n.actorFullName} ביטלה את השיבוץ לבקשה {when(n)}. הבקשה חזרה להמתין לשמרטפית.
      </>
    ),
  },
}

export default function NotificationsBell() {
  const [items, setItems] = useState<NotificationDto[]>([])
  const [open, setOpen] = useState(false)
  const [ring, setRing] = useState(false)
  const loadedOnce = useRef(false)
  const knownIds = useRef(new Set<number>())
  // הודעות שנסגרו כאן. טעינה שיצאה לפני שהמחיקה נשמרה בשרת עדיין מחזירה אותן - לא מציגים אותן שוב.
  const dismissedIds = useRef(new Set<number>())
  const containerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  async function load(signal?: AbortSignal) {
    const list = (await babylinkApi.getNotifications(signal)).filter((n) => !dismissedIds.current.has(n.id))
    const hasNew = list.some((n) => !knownIds.current.has(n.id))
    knownIds.current = new Set(list.map((n) => n.id))

    setItems((prev) => (sameData(prev, list) ? prev : list))
    if (!loadedOnce.current) {
      // הכניסה הראשונה: אם יש הודעות - פותחים את הרשימה
      loadedOnce.current = true
      if (list.length > 0) setOpen(true)
    } else if (hasNew) {
      // הודעה חדשה תוך כדי עבודה - נענוע קצר של הפעמון
      setRing(true)
      window.setTimeout(() => setRing(false), 2500)
    }
  }

  // טעינה בכניסה ובכל מעבר בין מסכים, ובנוסף כל 15 שניות (עדכון חי)
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).catch(() => {
      // אם הטעינה נכשלה - הפעמון פשוט נשאר כמו שהוא, ולא מפריע לשאר המסך
    })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  usePolling(() => load(), BELL_REFRESH_MS)

  // סגירה בלחיצה מחוץ לחלונית או ב-Esc
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // עדכון אופטימי: ההודעה נעלמת מיד, והמחיקה בשרת רצה ברקע
  function dismiss(id: number) {
    dismissedIds.current.add(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
    babylinkApi.dismissNotification(id).catch(() => undefined)
  }

  function dismissAll() {
    items.forEach((n) => dismissedIds.current.add(n.id))
    setItems([])
    setOpen(false)
    babylinkApi.dismissAllNotifications().catch(() => undefined)
  }

  return (
    <div className="notif" ref={containerRef}>
      <button
        type="button"
        className={`notif-button ${items.length > 0 ? 'has-items' : ''} ${ring ? 'ring' : ''}`}
        aria-label={items.length > 0 ? `הודעות (${items.length} חדשות)` : 'הודעות'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={20} />
        {items.length > 0 && <span className="notif-count">{items.length}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="הודעות">
          <div className="notif-head">
            <strong>הודעות</strong>
            {items.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={dismissAll}>
                סגירת כולן
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="notif-empty">אין הודעות חדשות</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => {
                const kind = KINDS[n.type] ?? KINDS.RequestCancelled
                const body = (
                  <>
                    <strong>{kind.title}</strong>
                    <p>{kind.text(n)}</p>
                    <span className="notif-time">
                      {formatTimeAgo(n.createdAtUtc)}
                      {n.requestId !== null && ' · לפרטי הבקשה'}
                    </span>
                  </>
                )
                return (
                  <li key={n.id} className="notif-item">
                    <span className={`notif-icon tone-${kind.tone}`}>
                      <kind.Icon size={18} />
                    </span>
                    {n.requestId !== null ? (
                      <Link to={`/requests/${n.requestId}`} className="notif-body notif-link" onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      <div className="notif-body">{body}</div>
                    )}
                    <button type="button" className="notif-dismiss" onClick={() => dismiss(n.id)} aria-label="סגירת ההודעה">
                      <X size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
