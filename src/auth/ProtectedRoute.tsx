// נתיבים מוגנים: מי שלא מחובר מועבר למסך ההתחברות (וחוזר לאותו עמוד אחרי שהתחבר).
// roles - רק לנוחות ה-UI (למשל שמרטפית לא תגיע לטופס "בקשה חדשה"). השרת הוא שאוכף בפועל.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../api/types'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  roles?: UserRole[]
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/requests" replace />
  }

  return <Outlet />
}
