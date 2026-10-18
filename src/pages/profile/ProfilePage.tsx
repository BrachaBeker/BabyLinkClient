// הפרופיל שלי: עדכון שם, טלפון, עיר וכתובת (להורה - הכתובת שממלאת מראש כל בקשה חדשה).
// אימייל ותפקיד מוצגים בלבד. השרת מאפשר לעדכן רק את המשתמש המחובר (PUT /api/users/{id}).
import { ArrowRight, Check, Mail, MapPin, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { babylinkApi } from '../../api/babylink'
import { isApiError } from '../../api/client'
import type { UserDto } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import FormField from '../../components/FormField'
import { LoadingState, Spinner, useSlowNotice, WakeNote } from '../../components/Loading'
import { roleLabel } from '../../utils/format'
import './profile.css'

interface FormState {
  fullName: string
  phone: string
  city: string
  street: string
  houseNumber: string
}

type Errors = Partial<Record<keyof FormState, string>>

function fromUser(user: UserDto): FormState {
  return {
    fullName: user.fullName,
    phone: user.phone,
    city: user.city,
    street: user.street ?? '',
    houseNumber: user.houseNumber ?? '',
  }
}

// בדיקה מקדימה - אותם כללים שהשרת בודק
function validate(form: FormState, isParent: boolean): Errors {
  const errors: Errors = {}
  if (!form.fullName.trim()) errors.fullName = 'שדה חובה'
  if (!form.phone.trim()) errors.phone = 'שדה חובה'
  else if (!/^[\d\s+()-]{7,20}$/.test(form.phone.trim())) errors.phone = 'מספר טלפון לא תקין'
  if (!form.city.trim()) errors.city = 'שדה חובה'
  if (isParent) {
    if (!form.street.trim()) errors.street = 'שדה חובה'
    if (!form.houseNumber.trim()) errors.houseNumber = 'שדה חובה'
  }
  return errors
}

export default function ProfilePage() {
  const { user, updateFullName } = useAuth()
  const isParent = user?.role === 'Parent'

  const [profile, setProfile] = useState<UserDto | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const slow = useSlowNotice(saving)

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    babylinkApi
      .getUser(user.id, controller.signal)
      .then((result) => {
        setProfile(result)
        setForm(fromUser(result))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setLoadError(isApiError(err) ? err.message : 'לא ניתן לטעון את הפרופיל.')
      })
    return () => controller.abort()
  }, [user])

  function update(key: keyof FormState, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!form || !user) return
    setFormError(null)
    setSaved(false)

    const clientErrors = validate(form, isParent)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSaving(true)
    try {
      const updated = await babylinkApi.updateUser(user.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        street: isParent ? form.street.trim() : null,
        houseNumber: isParent ? form.houseNumber.trim() : null,
      })
      setProfile(updated)
      setForm(fromUser(updated))
      updateFullName(updated.fullName)
      setSaved(true)
    } catch (err) {
      if (isApiError(err) && err.status === 400 && err.problem?.errors) {
        setErrors(err.fieldErrors as Errors)
      }
      setFormError(isApiError(err) ? err.message : 'אירעה שגיאה. נסו שוב.')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <Alert variant="error" title="לא הצלחנו לטעון את הפרופיל">{loadError}</Alert>
  if (!profile || !form) return <LoadingState text="טוען את הפרופיל..." />

  const cls = (key: keyof FormState, extra = '') => `input ${extra} ${errors[key] ? 'has-error' : ''}`

  return (
    <div className="profile-page">
      <Link to="/requests" className="back-link">
        <ArrowRight size={16} />
        חזרה לבקשות
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">הפרופיל שלי</h1>
          <p className="page-subtitle">
            {isParent
              ? 'הכתובת כאן ממולאת אוטומטית בכל בקשה חדשה.'
              : 'הפרטים שלך מוצגים להורה של בקשה שתפסת.'}
          </p>
        </div>
      </div>

      <section className="card profile-summary">
        <span className="profile-avatar">
          <UserRound size={28} />
        </span>
        <div>
          <strong className="profile-name">{profile.fullName}</strong>
          <span className="profile-meta">
            <span className="badge badge-assigned">{roleLabel(profile.role)}</span>
            <span className="profile-email">
              <Mail size={14} />
              <bdi dir="ltr">{profile.email}</bdi>
            </span>
          </span>
        </div>
      </section>

      <form className="card card-body stack" onSubmit={handleSubmit} noValidate>
        {saved && (
          <Alert variant="success" onClose={() => setSaved(false)}>
            הפרטים נשמרו.
          </Alert>
        )}
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="form-grid">
          <FormField label="שם מלא" htmlFor="p-name" error={errors.fullName} className="span-2">
            <input
              id="p-name"
              className={cls('fullName')}
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </FormField>
          <FormField label="טלפון" htmlFor="p-phone" error={errors.phone}>
            <input
              id="p-phone"
              className={cls('phone', 'input-ltr')}
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </FormField>
          <FormField label="עיר" htmlFor="p-city" error={errors.city}>
            <input
              id="p-city"
              className={cls('city')}
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
            />
          </FormField>

          {isParent && (
            <>
              <h2 className="card-title span-2 profile-section-title">
                <MapPin size={18} />
                כתובת הבית
              </h2>
              <FormField label="רחוב" htmlFor="p-street" error={errors.street}>
                <input
                  id="p-street"
                  className={cls('street')}
                  autoComplete="address-line1"
                  value={form.street}
                  onChange={(e) => update('street', e.target.value)}
                />
              </FormField>
              <FormField label="מספר בית" htmlFor="p-house" error={errors.houseNumber}>
                <input
                  id="p-house"
                  className={cls('houseNumber')}
                  value={form.houseNumber}
                  onChange={(e) => update('houseNumber', e.target.value)}
                />
              </FormField>
            </>
          )}
        </div>

        <div className="profile-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <Spinner /> : <Check size={18} />}
            {saving ? 'שומר...' : 'שמירת הפרטים'}
          </button>
          {slow && <WakeNote />}
        </div>
      </form>
    </div>
  )
}
