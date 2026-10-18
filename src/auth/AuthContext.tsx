// מצב ההתחברות של כל האפליקציה: ה-token (ב-localStorage) והמשתמש המחובר (id, שם, תפקיד).
// הערה: הלקוח משתמש בתפקיד רק כדי להחליט מה *להציג*. ההרשאות עצמן נאכפות בשרת לפי ה-JWT.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { babylinkApi } from '../api/babylink'
import { setUnauthorizedHandler, tokenStorage } from '../api/client'
import type { RegisterRequest, UserRole } from '../api/types'

export interface AuthUser {
  id: number
  fullName: string
  role: UserRole
}

interface StoredSession {
  user: AuthUser
  expiresAtUtc: string
}

interface AuthContextValue {
  user: AuthUser | null
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (data: RegisterRequest) => Promise<AuthUser>
  logout: () => void
}

const SESSION_KEY = 'babylink.session'

const AuthContext = createContext<AuthContextValue | null>(null)

// קריאת ההתחברות השמורה בטעינת הדף. אם אין token או שפג תוקפו - מתחילים מנותקים.
function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw || !tokenStorage.get()) return null
    const session = JSON.parse(raw) as StoredSession
    if (new Date(session.expiresAtUtc).getTime() <= Date.now()) return null
    return session.user
  } catch {
    return null
  }
}

function clearStorage() {
  tokenStorage.clear()
  localStorage.removeItem(SESSION_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const loaded = loadSession()
    if (!loaded) clearStorage()
    return loaded
  })
  const [sessionExpired, setSessionExpired] = useState(false)

  const logout = useCallback(() => {
    clearStorage()
    setSessionExpired(false)
    setUser(null)
  }, [])

  // 401 מהשרת (token פג או לא תקף) -> מנתקים ומסמנים, כדי שמסך ההתחברות יסביר למה.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStorage()
      setSessionExpired(true)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await babylinkApi.login({ email, password })
    const authUser: AuthUser = { id: response.userId, fullName: response.fullName, role: response.role }
    tokenStorage.set(response.token)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: authUser, expiresAtUtc: response.expiresAtUtc }))
    setSessionExpired(false)
    setUser(authUser)
    return authUser
  }, [])

  // אחרי הרשמה מוצלחת מתחברים מיד, כדי לחסוך למשתמש הקלדה חוזרת.
  const register = useCallback(
    async (data: RegisterRequest) => {
      await babylinkApi.register(data)
      return login(data.email, data.password)
    },
    [login],
  )

  const value = useMemo(
    () => ({ user, sessionExpired, login, register, logout }),
    [user, sessionExpired, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
