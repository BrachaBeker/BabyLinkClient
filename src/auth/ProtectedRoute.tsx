// נתיבים מוגנים: מי שלא מחובר מועבר למסך ההתחברות (ואחרי ההתחברות - לרשימת הבקשות).
// roles - רק לנוחות ה-UI (למשל שמרטפית לא תגיע לטופס "בקשה חדשה"). השרת הוא שאוכף בפועל.
import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../api/types'
import { useAuth } from './AuthContext'

interface ProtectedRouteProps {
  roles?: UserRole[]
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/requests" replace />
  }

  return <Outlet />
}
