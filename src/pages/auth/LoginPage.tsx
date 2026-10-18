// מסך 1: התחברות והרשמה. צד אחד - הסבר קצר על BabyLink, צד שני - הטופס עם לשוניות.
import { CalendarClock, ShieldCheck, Zap } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import { Brand } from '../../components/Layout'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import './auth.css'

type Mode = 'login' | 'register'

const FEATURES = [
  { Icon: CalendarClock, title: 'מפרסמים בקשה בדקה', text: 'הכתובת כבר ממולאת מהפרופיל. מועד, ילדים ותעריף - וזהו.' },
  { Icon: Zap, title: 'הראשונה שתופסת - זוכה', text: 'בלי התכתבויות. שמרטפית לוחצת "אני לוקחת" והבקשה שלה.' },
  { Icon: ShieldCheck, title: 'ההורה בשליטה', text: 'לא מתאים? מבטלים ומפרסמים מחדש, והשמרטפית מקבלת הודעה.' },
]

// אחרי התחברות או הרשמה תמיד מגיעים לרשימת הבקשות (ולא לעמוד האחרון שהיה פתוח).
const HOME = '/requests'

export default function LoginPage() {
  const { user, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')

  if (user) return <Navigate to={HOME} replace />

  const goNext = () => navigate(HOME, { replace: true })

  return (
    <div className="auth-page">
      <aside className="auth-hero">
        <Brand />
        <div className="auth-hero-content">
          <h1>
            שמרטפית מתאימה,
            <br />
            <span>בלחיצה אחת.</span>
          </h1>
          <p className="auth-hero-lead">
            BabyLink מחברת בין הורים שמחפשים שמרטפות לבין שמרטפיות שמחפשות עבודה - מהר, פשוט ובלי התכתבויות.
          </p>
          <ul className="auth-features">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title}>
                <span className="auth-feature-icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-hero-foot">
          פרויקט סיום · <bdi dir="ltr">.NET 10 Web API + React</bdi>
        </p>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Brand />
          </div>

          <h2 className="auth-title">{mode === 'login' ? 'ברוכים השבים' : 'יצירת חשבון חדש'}</h2>
          <p className="auth-subtitle">
            {mode === 'login' ? 'התחברו כדי לראות את בקשות השמרטפות.' : 'כמה פרטים ואתם בפנים.'}
          </p>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              התחברות
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              הרשמה
            </button>
          </div>

          {sessionExpired && mode === 'login' && (
            <Alert variant="warning" className="auth-alert">
              פג תוקף ההתחברות. יש להתחבר מחדש.
            </Alert>
          )}

          {mode === 'login' ? <LoginForm onSuccess={goNext} /> : <RegisterForm onSuccess={goNext} />}
        </div>
      </section>
    </div>
  )
}
