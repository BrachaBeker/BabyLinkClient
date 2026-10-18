import { Baby, HeartHandshake, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { isApiError } from '../../api/client'
import type { RegisterRequest, UserRole } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import FormField from '../../components/FormField'
import { Spinner, useSlowNotice, WakeNote } from '../../components/Loading'

type FormState = Omit<RegisterRequest, 'role'> & { role: UserRole | '' }
type Errors = Partial<Record<keyof FormState, string>>

const EMPTY: FormState = { fullName: '', email: '', phone: '', city: '', password: '', role: '' }

const ROLES: { value: UserRole; title: string; text: string; Icon: typeof Baby }[] = [
  { value: 'Parent', title: 'הורה', text: 'מפרסם/ת בקשות שמרטפות', Icon: Baby },
  { value: 'Babysitter', title: 'שמרטפית', text: 'מוצאת ותופסת עבודות', Icon: HeartHandshake },
]

// בדיקה מקדימה לנוחות בלבד - השרת בודק שוב ומחזיר 400 אם משהו לא תקין.
function validate(form: FormState): Errors {
  const errors: Errors = {}
  if (!form.fullName.trim()) errors.fullName = 'שדה חובה'
  if (!form.email.trim()) errors.email = 'שדה חובה'
  else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'כתובת אימייל לא תקינה'
  if (!form.phone.trim()) errors.phone = 'שדה חובה'
  else if (!/^[\d\s+()-]{7,20}$/.test(form.phone.trim())) errors.phone = 'מספר טלפון לא תקין'
  if (!form.city.trim()) errors.city = 'שדה חובה'
  if (form.password.length < 8) errors.password = 'לפחות 8 תווים'
  if (!form.role) errors.role = 'יש לבחור תפקיד'
  return errors
}

export default function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const { register } = useAuth()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const slow = useSlowNotice(submitting)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const clientErrors = validate(form)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSubmitting(true)
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        password: form.password,
        role: form.role as UserRole,
      })
      onSuccess()
    } catch (err) {
      setSubmitting(false)
      if (!isApiError(err)) {
        setFormError('אירעה שגיאה. נסו שוב.')
        return
      }
      if (err.status === 409) {
        // האימייל כבר רשום - מציגים את ההודעה מהשרת ליד שדה האימייל
        setErrors({ email: err.message })
      } else if (err.status === 400 && err.problem?.errors) {
        setErrors(err.fieldErrors as Errors)
        setFormError(err.message)
      } else {
        setFormError(err.message)
      }
    }
  }

  const inputClass = (key: keyof FormState, extra = '') => `input ${extra} ${errors[key] ? 'has-error' : ''}`

  return (
    <form className="stack" onSubmit={handleSubmit} noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="field">
        <span className="field-label">אני...</span>
        <div className="role-picker" role="radiogroup" aria-label="תפקיד">
          {ROLES.map(({ value, title, text, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.role === value}
              className={`role-option ${form.role === value ? 'selected' : ''}`}
              onClick={() => update('role', value)}
            >
              <span className="role-icon">
                <Icon size={20} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
            </button>
          ))}
        </div>
        {errors.role && <span className="field-error">{errors.role}</span>}
      </div>

      <div className="form-grid">
        <FormField label="שם מלא" htmlFor="reg-name" error={errors.fullName} className="span-2">
          <input
            id="reg-name"
            className={inputClass('fullName')}
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
          />
        </FormField>

        <FormField label="אימייל" htmlFor="reg-email" error={errors.email} className="span-2">
          <input
            id="reg-email"
            className={inputClass('email', 'input-ltr')}
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </FormField>

        <FormField label="טלפון" htmlFor="reg-phone" error={errors.phone}>
          <input
            id="reg-phone"
            className={inputClass('phone', 'input-ltr')}
            type="tel"
            autoComplete="tel"
            placeholder="050-1234567"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
        </FormField>

        <FormField label="עיר" htmlFor="reg-city" error={errors.city}>
          <input
            id="reg-city"
            className={inputClass('city')}
            autoComplete="address-level2"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
          />
        </FormField>

        <FormField label="סיסמה" htmlFor="reg-password" error={errors.password} hint="לפחות 8 תווים" className="span-2">
          <input
            id="reg-password"
            className={inputClass('password', 'input-ltr')}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </FormField>
      </div>

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
        {submitting ? <Spinner /> : <UserPlus size={18} />}
        {submitting ? 'יוצר חשבון...' : 'יצירת חשבון'}
      </button>

      {slow && <WakeNote />}
    </form>
  )
}
