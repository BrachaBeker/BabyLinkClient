// מצבי טעינה. השרת ב-Render "נרדם" אחרי זמן ללא שימוש, והבקשה הראשונה לוקחת עד כדקה -
// לכן אחרי כמה שניות של המתנה מוסיפים הסבר, כדי שהמשתמש לא יחשוב שהאתר תקוע.
import { useEffect, useState } from 'react'

const SLOW_AFTER_MS = 5000

export function useSlowNotice(active: boolean, delay = SLOW_AFTER_MS) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), delay)
    return () => clearTimeout(timer)
  }, [active, delay])
  return slow
}

export function Spinner({ large = false }: { large?: boolean }) {
  return <span className={`spinner ${large ? 'spinner-lg' : ''}`} aria-hidden="true" />
}

export function WakeNote() {
  return (
    <p className="wake-note">
      השרת מתעורר ממצב שינה (שרת חינמי). הטעינה הראשונה יכולה לקחת עד כדקה - תודה על הסבלנות.
    </p>
  )
}

export function LoadingState({ text = 'טוען...' }: { text?: string }) {
  const slow = useSlowNotice(true)
  return (
    <div className="loading-state" aria-live="polite">
      <Spinner large />
      <span>{text}</span>
      {slow && <WakeNote />}
    </div>
  )
}
