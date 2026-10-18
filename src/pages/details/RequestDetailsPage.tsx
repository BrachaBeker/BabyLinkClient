// מסך 3: פרטי בקשה. שמרטפית יכולה לתפוס ("אני לוקחת"), וההורה שפרסם יכול לערוך ולמחוק.
//
// תרחיש ה-409: שתי שמרטפיות פותחות את אותה בקשה פנויה. הראשונה לוחצת "אני לוקחת" ומקבלת 200.
// השנייה עדיין רואה "פנויה" (המסך שלה לא התעדכן), לוחצת - והשרת מחזיר 409. אצלה מוצגת הודעה
// בולטת עם ה-detail מהשרת, והבקשה נטענת מחדש מיד - כך שהיא רואה "נתפסה" ואת שם מי שתפסה.
import {
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Hand,
  Home,
  Lock,
  MapPin,
  Pencil,
  Phone,
  SearchX,
  Tag as TagIcon,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { babylinkApi } from '../../api/babylink'
import { isApiError } from '../../api/client'
import type { ServiceRequestDetails } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'
import { LoadingState, Spinner, useSlowNotice, WakeNote } from '../../components/Loading'
import StatusBadge from '../../components/StatusBadge'
import {
  childrenLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTimeRange,
} from '../../utils/format'
import './details.css'

type Notice =
  | { kind: 'success'; title: string; text?: string }
  | { kind: 'conflict'; text: string }
  | { kind: 'error'; title?: string; text: string }

export default function RequestDetailsPage() {
  const { id } = useParams()
  const requestId = Number(id)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [request, setRequest] = useState<ServiceRequestDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // הודעה שהגיעה מהטופס: הצלחה (flash) או שגיאה (flashError - למשל 409 בעריכה)
  const [notice, setNotice] = useState<Notice | null>(() => {
    const state = location.state as { flash?: string; flashError?: string } | null
    if (state?.flashError) return { kind: 'error', title: 'השינויים לא נשמרו', text: state.flashError }
    return state?.flash ? { kind: 'success', title: state.flash } : null
  })
  const [assigning, setAssigning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const slowAction = useSlowNotice(assigning || deleting)

  // מנקים את ה-flash מה-history כדי שלא יופיע שוב ברענון
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await babylinkApi.getRequest(requestId, signal)
        setRequest(result)
        setLoadError(null)
      } catch (err) {
        if (signal?.aborted) return
        setLoadError({
          status: isApiError(err) ? err.status : 0,
          message: isApiError(err) ? err.message : 'לא ניתן לטעון את הבקשה.',
        })
      }
    },
    [requestId],
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    load(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [load])

  // רענון "שקט" - הנתונים הקיימים נשארים על המסך עד שמגיעים החדשים
  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function showNotice(next: Notice) {
    setNotice(next)
    requestAnimationFrame(() => noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  // ---- תפיסה (שמרטפית) ----
  async function handleAssign() {
    setNotice(null)
    setAssigning(true)
    try {
      const updated = await babylinkApi.assignRequest(requestId)
      setRequest(updated)
      showNotice({
        kind: 'success',
        title: 'הבקשה שלך!',
        text: 'תפסת את הבקשה בהצלחה. פרטי ההורה מופיעים למטה - כדאי ליצור קשר ולתאם.',
      })
    } catch (err) {
      if (isApiError(err) && err.status === 409) {
        // מישהי אחרת הקדימה (או שיבוץ חופף) - מציגים את ההודעה מהשרת ומרעננים את הבקשה
        showNotice({ kind: 'conflict', text: err.message })
        await refresh()
      } else if (isApiError(err) && err.status === 400) {
        showNotice({ kind: 'error', title: 'עבר המועד', text: err.message })
        await refresh()
      } else {
        showNotice({ kind: 'error', text: isApiError(err) ? err.message : 'אירעה שגיאה. נסו שוב.' })
      }
    } finally {
      setAssigning(false)
    }
  }

  // ---- מחיקה (ההורה שפרסם) ----
  async function handleDelete() {
    setDeleting(true)
    try {
      await babylinkApi.deleteRequest(requestId)
      navigate('/requests', { replace: true, state: { flash: 'הבקשה נמחקה בהצלחה.' } })
    } catch (err) {
      setDeleting(false)
      setConfirmDelete(false)
      showNotice({ kind: 'error', title: 'המחיקה נכשלה', text: isApiError(err) ? err.message : 'אירעה שגיאה.' })
      if (isApiError(err) && err.status === 409) await refresh()
    }
  }

  // ---------- Render ----------

  const backLink = (
    <Link to="/requests" className="back-link">
      <ArrowRight size={16} />
      חזרה לבקשות
    </Link>
  )

  if (loading) return <LoadingState text="טוען את פרטי הבקשה..." />

  if (loadError || !request) {
    return (
      <>
        {backLink}
        <div className="card">
          <EmptyState
            Icon={SearchX}
            title={loadError?.status === 404 ? 'הבקשה לא נמצאה' : 'לא הצלחנו לטעון את הבקשה'}
            text={loadError?.status === 404 ? 'ייתכן שהיא נמחקה על ידי ההורה.' : loadError?.message}
            action={
              <Link to="/requests" className="btn btn-secondary">
                לרשימת הבקשות
              </Link>
            }
          />
        </div>
      </>
    )
  }

  const isOwner = user?.role === 'Parent' && user.id === request.parentId
  const isSitter = user?.role === 'Babysitter'
  const assignedToMe = request.isAssigned && request.assignedBabysitterId === user?.id
  const canAssign = isSitter && !request.isAssigned && !request.isExpired

  return (
    <>
      {backLink}

      <div className="page-header details-header">
        <div>
          <div className="details-title-row">
            <h1 className="page-title">
              {request.street}, {request.city}
            </h1>
            <StatusBadge isAssigned={request.isAssigned} isExpired={request.isExpired} />
            {refreshing && <Spinner />}
          </div>
          <p className="page-subtitle">
            בקשה #{request.id} · פורסמה {formatDateTime(request.createdAtUtc)}
          </p>
        </div>
      </div>

      <div ref={noticeRef}>
        {notice?.kind === 'conflict' && (
          <Alert variant="error" title="אופס - הבקשה לא נתפסה" className="alert-conflict" onClose={() => setNotice(null)}>
            <p>{notice.text}</p>
            <p className="conflict-note">רעננו את הנתונים מהשרת - כך הבקשה נראית עכשיו.</p>
          </Alert>
        )}
        {notice?.kind === 'success' && (
          <Alert variant="success" title={notice.title} className="details-notice" onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
        {notice?.kind === 'error' && (
          <Alert variant="error" title={notice.title} className="details-notice" onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
      </div>

      <div className="details-layout">
        {/* ---- עמודה ראשית: פרטי הבקשה ---- */}
        <div className="stack">
          <section className="card card-body">
            <h2 className="card-title">
              <CalendarDays size={18} />
              מתי
            </h2>
            <div className="info-grid">
              <InfoItem Icon={CalendarDays} label="תאריך" value={formatDate(request.startTimeUtc)} />
              <InfoItem Icon={Clock} label="שעות" value={formatTimeRange(request.startTimeUtc, request.endTimeUtc)} />
              <InfoItem Icon={Clock} label="משך" value={formatDuration(request.startTimeUtc, request.endTimeUtc)} />
              <InfoItem Icon={Baby} label="ילדים" value={childrenLabel(request.childrenCount)} />
            </div>
          </section>

          <section className="card card-body">
            <h2 className="card-title">
              <MapPin size={18} />
              כתובת
            </h2>
            <p className="address-line">
              <Home size={17} />
              {request.street} {request.houseNumber}, {request.city}
            </p>
            {request.addressNotes && <p className="address-notes">{request.addressNotes}</p>}
          </section>

          {request.description && (
            <section className="card card-body">
              <h2 className="card-title">
                <FileText size={18} />
                תיאור
              </h2>
              <p className="description">{request.description}</p>
            </section>
          )}

          {request.tags.length > 0 && (
            <section className="card card-body">
              <h2 className="card-title">
                <TagIcon size={18} />
                תגיות
              </h2>
              <div className="tag-list">
                {request.tags.map((tag) => (
                  <span key={tag.id} className="tag tag-lg">
                    {tag.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ---- עמודת צד: תעריף, פעולות ואנשי קשר ---- */}
        <aside className="stack details-aside">
          <section className="card card-body action-card">
            <div className="price">
              {formatCurrency(request.hourlyRate)}
              <span>לשעה</span>
            </div>

            {canAssign && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block take-btn"
                  onClick={handleAssign}
                  disabled={assigning || refreshing}
                >
                  {assigning ? <Spinner /> : <Hand size={20} />}
                  {assigning ? 'תופסת...' : 'אני לוקחת'}
                </button>
                <p className="action-hint">הראשונה שתופסת - זוכה. אחרי התפיסה כדאי ליצור קשר עם ההורה ולתאם.</p>
              </>
            )}

            {isSitter && assignedToMe && (
              <div className="state-box state-mine">
                <CheckCircle2 size={20} />
                <div>
                  <strong>הבקשה שלך</strong>
                  <span>תפסת את הבקשה {request.assignedAtUtc && formatDateTime(request.assignedAtUtc)}</span>
                </div>
              </div>
            )}

            {isSitter && request.isAssigned && !assignedToMe && (
              <div className="state-box state-taken">
                <Lock size={20} />
                <div>
                  <strong>הבקשה כבר נתפסה</strong>
                  <span>שמרטפית אחרת הקדימה.</span>
                </div>
              </div>
            )}

            {!request.isAssigned && request.isExpired && (
              <div className="state-box state-expired">
                <Clock size={20} />
                <div>
                  <strong>עבר המועד</strong>
                  <span>מועד ההתחלה של הבקשה כבר עבר.</span>
                </div>
              </div>
            )}

            {isOwner && (
              <div className="owner-actions">
                {request.isAssigned ? (
                  <>
                    <button type="button" className="btn btn-secondary btn-block" disabled>
                      <Pencil size={16} />
                      עריכה
                    </button>
                    <p className="action-hint">
                      <Lock size={13} /> לא ניתן לערוך בקשה שכבר נתפסה, אבל אפשר למחוק אותה.
                    </p>
                  </>
                ) : (
                  <Link to={`/requests/${request.id}/edit`} className="btn btn-secondary btn-block">
                    <Pencil size={16} />
                    עריכה
                  </Link>
                )}
                <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={16} />
                  מחיקה
                </button>
              </div>
            )}

            {slowAction && <WakeNote />}
          </section>

          <PersonCard title="ההורה" name={request.parentFullName} phone={request.parentPhone} />

          {request.isAssigned && request.assignedBabysitterFullName && (
            <PersonCard
              title="השמרטפית שתפסה"
              name={request.assignedBabysitterFullName}
              phone={request.assignedBabysitterPhone}
              note={request.assignedAtUtc ? `נתפסה ${formatDateTime(request.assignedAtUtc)}` : undefined}
              highlight
            />
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="למחוק את הבקשה?"
        text={
          request.isAssigned
            ? `הבקשה כבר נתפסה על ידי ${request.assignedBabysitterFullName ?? 'שמרטפית'}. כדאי לעדכן אותה. לא ניתן לבטל את המחיקה.`
            : 'הבקשה תוסר מהרשימה. לא ניתן לבטל את הפעולה.'
        }
        confirmLabel="כן, למחוק"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

// ---------- רכיבי עזר קטנים למסך ----------

function InfoItem({ Icon, label, value }: { Icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="info-item">
      <span className="info-icon">
        <Icon size={17} />
      </span>
      <div>
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
    </div>
  )
}

interface PersonCardProps {
  title: string
  name: string
  phone: string | null
  note?: string
  highlight?: boolean
}

function PersonCard({ title, name, phone, note, highlight }: PersonCardProps) {
  return (
    <section className={`card card-body person-card ${highlight ? 'highlight' : ''}`}>
      <span className="person-title">{title}</span>
      <div className="person-row">
        <span className="person-avatar">
          <UserRound size={20} />
        </span>
        <div className="person-info">
          <strong>{name}</strong>
          {phone && (
            <a href={`tel:${phone}`} className="person-phone">
              <Phone size={14} />
              <span dir="ltr">{phone}</span>
            </a>
          )}
        </div>
      </div>
      {note && <span className="person-note">{note}</span>}
    </section>
  )
}
