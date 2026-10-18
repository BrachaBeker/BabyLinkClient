import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { isApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import FormField from '../../components/FormField'
import { Spinner, useSlowNotice, WakeNote } from '../../components/Loading'

// משתמשי הדמו של השרת - לחיצה ממלאת את הטופס (נוח להדגמה של תרחיש ה-409 בשני דפדפנים).
const DEMO_PASSWORD = 'Demo123!'
const DEMO_USERS = [
  { label: 'הורה 1', email: 'parent1@babylink.dev' },
  { label: 'הורה 2', email: 'parent2@babylink.dev' },
  { label: 'שמרטפית 1', email: 'sitter1@babylink.dev' },
  { label: 'שמרטפית 2', email: 'sitter2@babylink.dev' },
]

export default function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const slow = useSlowNotice(submitting)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('יש למלא אימייל וסיסמה.')
      return
    }

    setSubmitting(true)
    try {
      await login(email.trim(), password)
      onSuccess()
    } catch (err) {
      // 401 -> "אימייל או סיסמה שגויים." (ה-detail מהשרת)
      setError(isApiError(err) ? err.message : 'אירעה שגיאה. נסו שוב.')
      setSubmitting(false)
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      <FormField label="אימייל" htmlFor="login-email">
        <input
          id="login-email"
          className="input input-ltr"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </FormField>

      <FormField label="סיסמה" htmlFor="login-password">
        <input
          id="login-password"
          className="input input-ltr"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
        {submitting ? <Spinner /> : <LogIn size={18} />}
        {submitting ? 'מתחבר...' : 'התחברות'}
      </button>

      {slow && <WakeNote />}

      <div className="demo-users">
        <span className="demo-title">התחברות מהירה עם משתמש דמו</span>
        <div className="demo-list">
          {DEMO_USERS.map((demo) => (
            <button
              key={demo.email}
              type="button"
              className={`demo-chip ${email === demo.email ? 'active' : ''}`}
              onClick={() => fillDemo(demo.email)}
              disabled={submitting}
            >
              {demo.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}
