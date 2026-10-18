// פעמון ההודעות בסרגל העליון: מספר ההודעות, ורשימה שנפתחת בלחיצה.
// בכניסה למערכת, אם יש הודעות - הרשימה נפתחת לבד, כך שהשמרטפית רואה מיד שבקשה שתפסה בוטלה.
import { Bell, CalendarX2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { babylinkApi } from '../api/babylink'
import type { NotificationDto } from '../api/types'
import { formatDate, formatTimeAgo, formatTimeRange } from '../utils/format'

export default function NotificationsBell() {
  const [items, setItems] = useState<NotificationDto[]>([])
  const [open, setOpen] = useState(false)
  const autoOpened = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // טעינה בכניסה ובכל מעבר בין מסכים (קריאה קטנה וזולה)
  useEffect(() => {
    const controller = new AbortController()
    babylinkApi
      .getNotifications(controller.signal)
      .then((list) => {
        setItems(list)
        if (list.length > 0 && !autoOpened.current) {
          autoOpened.current = true
          setOpen(true)
        }
      })
      .catch(() => {
        // אם הטעינה נכשלה - הפעמון פשוט נשאר ריק, ולא מפריע לשאר המסך
      })
    return () => controller.abort()
  }, [location.pathname])

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
    setItems((prev) => prev.filter((n) => n.id !== id))
    babylinkApi.dismissNotification(id).catch(() => undefined)
  }

  function dismissAll() {
    setItems([])
    setOpen(false)
    babylinkApi.dismissAllNotifications().catch(() => undefined)
  }

  return (
    <div className="notif" ref={containerRef}>
      <button
        type="button"
        className={`notif-button ${items.length > 0 ? 'has-items' : ''}`}
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
              {items.map((n) => (
                <li key={n.id} className="notif-item">
                  <span className="notif-icon">
                    <CalendarX2 size={18} />
                  </span>
                  <div className="notif-body">
                    <strong>בקשה שתפסת בוטלה</strong>
                    <p>
                      הבקשה ל{formatDate(n.requestStartTimeUtc)},{' '}
                      <span className="nowrap">{formatTimeRange(n.requestStartTimeUtc, n.requestEndTimeUtc)}</span>{' '}
                      ב{n.street} {n.houseNumber}, {n.city} בוטלה על ידי ההורה ({n.parentFullName}).
                    </p>
                    <span className="notif-time">{formatTimeAgo(n.createdAtUtc)}</span>
                  </div>
                  <button type="button" className="notif-dismiss" onClick={() => dismiss(n.id)} aria-label="סגירת ההודעה">
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
