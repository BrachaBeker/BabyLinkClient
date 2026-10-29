// מסגרת לכל המסכים המוגנים: סרגל עליון (לוגו, הודעות, המשתמש המחובר - קישור לפרופיל, יציאה) ותוכן העמוד.
import { Heart, LogOut } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { roleLabel } from '../utils/format'
import NotificationsBell from './NotificationsBell'

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Heart size={18} fill="currentColor" />
      </span>
      <span className="brand-text">
        Baby<em>Link</em>
      </span>
    </span>
  )
}

const CONTACT_EMAIL = 'bb0534155470@gmail.com'

// פוטר תחתון - גם במסכים המוגנים וגם במסך ההתחברות
export function SiteFooter() {
  return (
    <footer className="site-footer">
      © {new Date().getFullYear()} BabyLink · כל הזכויות שמורות ·{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">
        {CONTACT_EMAIL}
      </a>
    </footer>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/requests" aria-label="BabyLink - לרשימת הבקשות">
            <Brand />
          </Link>

          {user && (
            <div className="topbar-user">
              <NotificationsBell />
              <Link to="/profile" className="user-chip" title="הפרופיל שלי">
                <span className="avatar" aria-hidden="true">
                  {initials(user.fullName)}
                </span>
                <span className="user-meta">
                  <span className="user-name">{user.fullName}</span>
                  <span className="user-role">{roleLabel(user.role)} · הפרופיל שלי</span>
                </span>
              </Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
                <LogOut size={16} />
                יציאה
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
