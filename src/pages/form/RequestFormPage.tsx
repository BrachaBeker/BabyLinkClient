// מסך 4: טופס בקשה להורה. אותו טופס משמש ליצירה (POST) ולעריכה (PUT).
// בעריכה הטופס נטען עם הנתונים הקיימים. בבקשה חדשה הכתובת ממולאת מראש מהפרופיל (אפשר לשנות),
// וב"פרסום מחדש" / "פרסום שוב" - כל הפרטים מהבקשה הקודמת. הזמנים מוזנים בשעון מקומי ונשלחים ב-UTC.
import { ArrowRight, CalendarDays, Check, FileText, Home, Lock, MapPin, Send, Tag as TagIcon } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { babylinkApi } from '../../api/babylink'
import { isApiError } from '../../api/client'
import type { ServiceRequestBody, ServiceRequestDetails } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import FormField from '../../components/FormField'
import { LoadingState, Spinner, useSlowNotice, WakeNote } from '../../components/Loading'
import { useTags } from '../../hooks/useTags'
import { formatCurrency, formatDuration, localInputToUtc, toLocalInputValue, totalEarnings } from '../../utils/format'
import type { RepostState } from './repost'
import './form.css'

interface FormState {
  start: string
  end: string
  city: string
  street: string
  houseNumber: string
  addressNotes: string
  childrenCount: string
  hourlyRate: string
  description: string
  tagIds: number[]
}

type Errors = Partial<Record<keyof FormState, string>>

const MAX_HOURS = 24
const MAX_TAGS = 10
const MIN_RATE = 20
const MAX_RATE = 1000

// ברירת מחדל לבקשה חדשה: מחר, 18:00-22:00
function defaultForm(): FormState {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(18, 0, 0, 0)
  const end = new Date(start)
  end.setHours(22)
  return {
    start: toLocalInputValue(start.toISOString()),
    end: toLocalInputValue(end.toISOString()),
    city: '',
    street: '',
    houseNumber: '',
    addressNotes: '',
    childrenCount: '1',
    hourlyRate: '',
    description: '',
    tagIds: [],
  }
}

function fromDetails(request: ServiceRequestDetails): FormState {
  return {
    start: toLocalInputValue(request.startTimeUtc),
    end: toLocalInputValue(request.endTimeUtc),
    city: request.city,
    street: request.street,
    houseNumber: request.houseNumber,
    addressNotes: request.addressNotes ?? '',
    childrenCount: String(request.childrenCount),
    hourlyRate: String(request.hourlyRate),
    description: request.description ?? '',
    tagIds: request.tags.map((tag) => tag.id),
  }
}

// "פרסום מחדש": הפרטים מבקשה קודמת
function fromRepost(body: ServiceRequestBody): FormState {
  return {
    start: toLocalInputValue(body.startTimeUtc),
    end: toLocalInputValue(body.endTimeUtc),
    city: body.city,
    street: body.street,
    houseNumber: body.houseNumber,
    addressNotes: body.addressNotes ?? '',
    childrenCount: String(body.childrenCount),
    hourlyRate: String(body.hourlyRate),
    description: body.description ?? '',
    tagIds: body.tagIds,
  }
}

// בדיקה מקדימה לנוחות - אותם כללים שהשרת בודק (והשרת הוא הקובע).
function validate(form: FormState): Errors {
  const errors: Errors = {}
  const start = form.start ? new Date(form.start) : null
  const end = form.end ? new Date(form.end) : null

  if (!start) errors.start = 'שדה חובה'
  else if (start.getTime() <= Date.now()) errors.start = 'מועד ההתחלה חייב להיות בעתיד'

  if (!end) errors.end = 'שדה חובה'
  else if (start && end <= start) errors.end = 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'
  else if (start && end.getTime() - start.getTime() > MAX_HOURS * 3600_000) errors.end = 'משך השמרטפות עד 24 שעות'

  if (!form.city.trim()) errors.city = 'שדה חובה'
  if (!form.street.trim()) errors.street = 'שדה חובה'
  if (!form.houseNumber.trim()) errors.houseNumber = 'שדה חובה'

  const children = Number(form.childrenCount)
  if (!Number.isInteger(children) || children < 1 || children > 10) errors.childrenCount = 'מספר בין 1 ל-10'

  const rate = Number(form.hourlyRate)
  if (!form.hourlyRate || !Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) {
    errors.hourlyRate = `תעריף בין ${MIN_RATE} ל-${MAX_RATE} ₪ לשעה`
  }

  return errors
}

// שמות השדות בשרת -> שמות השדות בטופס (לשגיאות ולידציה 400)
const SERVER_FIELD_MAP: Record<string, keyof FormState> = {
  startTimeUtc: 'start',
  endTimeUtc: 'end',
  city: 'city',
  street: 'street',
  houseNumber: 'houseNumber',
  addressNotes: 'addressNotes',
  childrenCount: 'childrenCount',
  hourlyRate: 'hourlyRate',
  description: 'description',
  tagIds: 'tagIds',
}

export default function RequestFormPage() {
  const { id } = useParams()
  const isEdit = id !== undefined
  const requestId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { tags, loading: tagsLoading } = useTags()

  // הגענו מ"ביטול ופרסום מחדש" או מ"פרסום שוב"? (רק בבקשה חדשה)
  const repostState = isEdit ? null : (location.state as RepostState | null)
  const [form, setForm] = useState<FormState>(() =>
    repostState?.repost ? fromRepost(repostState.repost) : defaultForm(),
  )
  const [addressFromProfile, setAddressFromProfile] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const slow = useSlowNotice(submitting)

  // מצב טעינה בעריכה
  const [loading, setLoading] = useState(isEdit)
  const [blocked, setBlocked] = useState<{ title: string; text: string } | null>(null)

  useEffect(() => {
    if (!isEdit) return
    const controller = new AbortController()
    babylinkApi
      .getRequest(requestId, controller.signal)
      .then((request) => {
        if (request.parentId !== user?.id) {
          setBlocked({ title: 'אין הרשאה', text: 'רק ההורה שפרסם את הבקשה יכול לערוך אותה.' })
        } else if (request.isAssigned) {
          setBlocked({
            title: 'הבקשה כבר נתפסה',
            text: 'לא ניתן לערוך בקשה שכבר נתפסה. אפשר לבטל אותה ולפרסם אותה מחדש.',
          })
        } else {
          setForm(fromDetails(request))
        }
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setBlocked({
          title: isApiError(err) && err.status === 404 ? 'הבקשה לא נמצאה' : 'לא ניתן לטעון את הבקשה',
          text: isApiError(err) ? err.message : 'נסו שוב מאוחר יותר.',
        })
        setLoading(false)
      })
    return () => controller.abort()
  }, [isEdit, requestId, user?.id])

  // בקשה חדשה: הכתובת מהפרופיל (נשמרה בהרשמה). ממלאים רק אם השדות עדיין ריקים.
  const hasRepost = Boolean(repostState?.repost)
  useEffect(() => {
    if (isEdit || hasRepost || !user) return
    const controller = new AbortController()
    babylinkApi
      .getUser(user.id, controller.signal)
      .then((profile) => {
        if (!profile.street || !profile.houseNumber) return
        setForm((prev) =>
          prev.city || prev.street || prev.houseNumber
            ? prev
            : { ...prev, city: profile.city, street: profile.street ?? '', houseNumber: profile.houseNumber ?? '' },
        )
        setAddressFromProfile(true)
      })
      .catch(() => {
        // בלי כתובת שמורה - פשוט ממלאים ידנית
      })
    return () => controller.abort()
  }, [isEdit, hasRepost, user])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleTag(tagId: number) {
    const has = form.tagIds.includes(tagId)
    if (!has && form.tagIds.length >= MAX_TAGS) return
    update('tagIds', has ? form.tagIds.filter((t) => t !== tagId) : [...form.tagIds, tagId])
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const clientErrors = validate(form)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) {
      setFormError('יש לתקן את השדות המסומנים.')
      return
    }

    const body: ServiceRequestBody = {
      startTimeUtc: localInputToUtc(form.start),
      endTimeUtc: localInputToUtc(form.end),
      city: form.city.trim(),
      street: form.street.trim(),
      houseNumber: form.houseNumber.trim(),
      addressNotes: form.addressNotes.trim() || null,
      childrenCount: Number(form.childrenCount),
      hourlyRate: Number(form.hourlyRate),
      description: form.description.trim() || null,
      tagIds: form.tagIds,
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await babylinkApi.updateRequest(requestId, body)
        navigate(`/requests/${requestId}`, { replace: true, state: { flash: 'השינויים נשמרו בהצלחה.' } })
      } else {
        const created = await babylinkApi.createRequest(body)
        navigate(`/requests/${created.id}`, { replace: true, state: { flash: 'הבקשה פורסמה בהצלחה!' } })
      }
    } catch (err) {
      setSubmitting(false)
      if (!isApiError(err)) {
        setFormError('אירעה שגיאה. נסו שוב.')
        return
      }
      if (isEdit && err.status === 409) {
        // הבקשה נתפסה בזמן שההורה ערך - חוזרים למסך הפרטים ומציגים שם את ההודעה
        navigate(`/requests/${requestId}`, { replace: true, state: { flashError: err.message } })
        return
      }
      if (err.status === 400 && err.problem?.errors) {
        const mapped: Errors = {}
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          const key = SERVER_FIELD_MAP[field]
          if (key) mapped[key] = message
        }
        setErrors(mapped)
      }
      setFormError(err.message)
    }
  }

  // ---------- Render ----------

  const backTo = isEdit ? `/requests/${requestId}` : '/requests'

  if (loading) return <LoadingState text="טוען את הבקשה..." />

  if (blocked) {
    return (
      <div className="card">
        <EmptyState
          Icon={Lock}
          title={blocked.title}
          text={blocked.text}
          action={
            <Link to={backTo} className="btn btn-secondary">
              חזרה
            </Link>
          }
        />
      </div>
    )
  }

  const durationValid =
    form.start && form.end && new Date(form.end) > new Date(form.start)
      ? formatDuration(new Date(form.start).toISOString(), new Date(form.end).toISOString())
      : null
  // רמז חי מתחת לתעריף: סה"כ לבקשה לפי התעריף והשעות שנבחרו
  const rateValue = Number(form.hourlyRate)
  const totalHint =
    durationValid && rateValue >= MIN_RATE && rateValue <= MAX_RATE
      ? `סה"כ לבקשה: ${formatCurrency(totalEarnings(rateValue, localInputToUtc(form.start), localInputToUtc(form.end)))}`
      : null
  const nowLocal = toLocalInputValue(new Date().toISOString())
  const cls = (key: keyof FormState, base = 'input') => `${base} ${errors[key] ? 'has-error' : ''}`

  return (
    <div className="form-page">
      <Link to={backTo} className="back-link">
        <ArrowRight size={16} />
        {isEdit ? 'חזרה לפרטי הבקשה' : 'חזרה לבקשות'}
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? `עריכת בקשה #${requestId}` : 'בקשת שמרטפות חדשה'}</h1>
          <p className="page-subtitle">
            {isEdit ? 'עדכנו את הפרטים ושמרו.' : 'מלאו את הפרטים - והבקשה תופיע מיד אצל השמרטפיות.'}
          </p>
        </div>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        {repostState?.repostNotice && <Alert variant="info">{repostState.repostNotice}</Alert>}
        {formError && <Alert variant="error">{formError}</Alert>}

        <section className="card card-body">
          <h2 className="card-title">
            <CalendarDays size={18} />
            מתי?
          </h2>
          <div className="form-grid">
            <FormField label="התחלה" htmlFor="start" error={errors.start}>
              <input
                id="start"
                type="datetime-local"
                className={cls('start')}
                min={nowLocal}
                value={form.start}
                onChange={(e) => update('start', e.target.value)}
              />
            </FormField>
            <FormField
              label="סיום"
              htmlFor="end"
              error={errors.end}
              hint={durationValid ? `משך: ${durationValid}` : 'עד 24 שעות'}
            >
              <input
                id="end"
                type="datetime-local"
                className={cls('end')}
                min={form.start || nowLocal}
                value={form.end}
                onChange={(e) => update('end', e.target.value)}
              />
            </FormField>
          </div>
        </section>

        <section className="card card-body">
          <h2 className="card-title">
            <MapPin size={18} />
            איפה?
          </h2>
          {addressFromProfile && (
            <p className="profile-address-hint">
              <Home size={14} />
              הכתובת מהפרופיל שלכם - אפשר לשנות אותה לבקשה הזו.
            </p>
          )}
          <div className="form-grid form-grid-address">
            <FormField label="עיר" htmlFor="city" error={errors.city}>
              <input
                id="city"
                className={cls('city')}
                maxLength={100}
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
            </FormField>
            <FormField label="רחוב" htmlFor="street" error={errors.street}>
              <input
                id="street"
                className={cls('street')}
                maxLength={150}
                value={form.street}
                onChange={(e) => update('street', e.target.value)}
              />
            </FormField>
            <FormField label="מספר בית" htmlFor="houseNumber" error={errors.houseNumber}>
              <input
                id="houseNumber"
                className={cls('houseNumber')}
                maxLength={20}
                value={form.houseNumber}
                onChange={(e) => update('houseNumber', e.target.value)}
              />
            </FormField>
            <FormField
              label="הערות לכתובת"
              htmlFor="addressNotes"
              error={errors.addressNotes}
              optional
              className="span-all"
            >
              <input
                id="addressNotes"
                className={cls('addressNotes')}
                maxLength={200}
                placeholder="למשל: קומה 3, קוד לבניין 1234"
                value={form.addressNotes}
                onChange={(e) => update('addressNotes', e.target.value)}
              />
            </FormField>
          </div>
        </section>

        <section className="card card-body">
          <h2 className="card-title">
            <FileText size={18} />
            פרטים
          </h2>
          <div className="form-grid">
            <FormField label="מספר ילדים" htmlFor="childrenCount" error={errors.childrenCount}>
              <input
                id="childrenCount"
                type="number"
                min={1}
                max={10}
                className={cls('childrenCount')}
                value={form.childrenCount}
                onChange={(e) => update('childrenCount', e.target.value)}
              />
            </FormField>
            <FormField
              label="תעריף לשעה (₪)"
              htmlFor="hourlyRate"
              error={errors.hourlyRate}
              hint={totalHint ?? `מינימום ${MIN_RATE} ₪ לשעה`}
            >
              <input
                id="hourlyRate"
                type="number"
                min={MIN_RATE}
                max={MAX_RATE}
                step="0.5"
                inputMode="decimal"
                placeholder="למשל 50"
                className={cls('hourlyRate')}
                value={form.hourlyRate}
                onChange={(e) => update('hourlyRate', e.target.value)}
              />
            </FormField>
            <FormField label="תיאור" htmlFor="description" error={errors.description} optional className="span-2">
              <textarea
                id="description"
                className={cls('description', 'textarea')}
                maxLength={1000}
                placeholder="ספרו קצת על הילדים, על הערב ועל מה שחשוב לכם"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
              <span className="char-count">{form.description.length}/1000</span>
            </FormField>
          </div>
        </section>

        <section className="card card-body">
          <h2 className="card-title">
            <TagIcon size={18} />
            תגיות <span className="optional-inline">(לא חובה)</span>
          </h2>
          {tagsLoading ? (
            <span className="field-hint">
              <Spinner /> טוען תגיות...
            </span>
          ) : (
            <div className="chip-group" role="group" aria-label="תגיות">
              {tags.map((tag) => {
                const checked = form.tagIds.includes(tag.id)
                return (
                  <label key={tag.id} className="chip-toggle">
                    <input type="checkbox" checked={checked} onChange={() => toggleTag(tag.id)} />
                    <span>
                      {checked && <Check size={14} />}
                      {tag.name}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          {errors.tagIds && <span className="field-error">{errors.tagIds}</span>}
        </section>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? <Spinner /> : isEdit ? <Check size={18} /> : <Send size={18} />}
            {submitting ? 'שומר...' : isEdit ? 'שמירת שינויים' : 'פרסום הבקשה'}
          </button>
          <Link to={backTo} className="btn btn-ghost btn-lg">
            ביטול
          </Link>
          {slow && <WakeNote />}
        </div>
      </form>
    </div>
  )
}
