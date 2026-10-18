// עדכון חי ב-Polling: מריץ את הפונקציה כל intervalMs, ורק כשהטאב גלוי (טאב ברקע לא שולח בקשות).
// כשחוזרים לטאב - מרעננים מיד. סבב חדש לא מתחיל לפני שהקודם הסתיים.
//
// למה Polling ולא Push (SignalR)? פשוט, בלי טכנולוגיה נוספת בשרת, ועובד גם מאחורי סינון ו-Proxy.
// העדכון מצמצם התנגשויות אבל לא מבטל אותן - תמיד יש חלון זמן שבו שתי שמרטפיות רואות "פנויה",
// ולכן ה-409 של השרת נשאר ההגנה האמיתית.
import { useEffect, useRef } from 'react'

export const LIVE_REFRESH_MS = 10_000

export function usePolling(callback: () => Promise<unknown> | void, intervalMs = LIVE_REFRESH_MS, enabled = true) {
  // תמיד הגרסה העדכנית של ה-callback (בלי להפעיל מחדש את הטיימר בכל רינדור)
  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return
    let running = false

    const tick = async () => {
      if (running || document.visibilityState !== 'visible') return
      running = true
      try {
        await savedCallback.current()
      } catch {
        // שקט - ננסה שוב בסבב הבא
      } finally {
        running = false
      }
    }

    const timer = window.setInterval(() => void tick(), intervalMs)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs, enabled])
}

// השוואה פשוטה של תשובות מהשרת - כדי לעדכן state (ולרנדר) רק כשמשהו באמת השתנה
export function sameData(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}
