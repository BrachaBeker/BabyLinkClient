// מסך 3: פרטי בקשה. שמרטפית יכולה לתפוס ("אני לוקחת"). ההורה שפרסם יכול לערוך (כל עוד לא נתפסה),
// לבטל - גם אחרי שנתפסה, כי הוא לא מחויב לשמרטפית (ואז היא מקבלת הודעה) - ולפרסם מחדש.
//
// תרחיש ה-409: שתי שמרטפיות פותחות את אותה בקשה פנויה. הראשונה לוחצת "אני לוקחת" ומקבלת 200.
// השנייה עדיין רואה "פנויה" (המסך שלה לא התעדכן), לוחצת - והשרת מחזיר 409. אצלה מוצגת הודעה
// בולטת עם ה-detail מהשרת, והבקשה נטענת מחדש מיד - כך שהיא רואה "נתפסה" ומתי (בלי לדעת מי תפסה).
import {
  ArrowRight,
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  EyeOff,
  FileText,
  Hand,
  Home,
  Lock,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Repeat,
  SearchX,
  ShieldCheck,
  Tag as TagIcon,
  Trash2,
  UserRound,
  UserX,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { LIVE_REFRESH_MS, sameData, usePolling } from '../../hooks/usePolling'
import {
  childrenLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDuration,
  formatElapsed,
  formatTimeRange,
  nextWeeklySlot,
  totalEarnings,
} from '../../utils/format'
import { toRepost, type RepostState } from '../form/repost'
import './details.css'

type Notice =
  | { kind: 'success'; title: string; text?: string }
  | { kind: 'info'; title: string; text?: string }
  | { kind: 'conflict'; text: string }
  | { kind: 'error'; title?: string; text: string }

// שינוי שקרה בבקשה בגלל מישהו אחר (התגלה בעדכון החי) - איזו הודעה להציג, אם בכלל
function describeChange(prev: ServiceRequestDetails, next: ServiceRequestDetails, userId?: number): Notice | null {
  const isOwner = userId === next.parentId
  if (!prev.isAssigned && next.isAssigned) {
    if (isOwner) {
      return { kind: 'success', title: 'נמצאה שמרטפית!', text: `${next.assignedBabysitterFullName ?? 'שמרטפית'} תפסה את הבקשה.` }
    }
    if (next.assignedBabysitterId !== userId) {
      return { kind: 'info', title: 'הבקשה נתפסה הרגע', text: 'שמרטפית אחרת תפסה את הבקשה הזו.' }
    }
  }
  if (prev.isAssigned && !next.isAssigned) {
    if (isOwner) {
      return { kind: 'info', title: 'השמרטפית ביטלה את השיבוץ', text: 'הבקשה חזרה להמתין לשמרטפית.' }
    }
    if (prev.assignedBabysitterId !== userId) {
      return { kind: 'info', title: 'הבקשה התפנתה', text: 'השמרטפית שתפסה ביטלה את השיבוץ - אפשר לתפוס אותה עכשיו.' }
    }
  }
  return null
}

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
  // איזה ביטול מחכה לאישור: ביטול רגיל, או ביטול ופרסום מחדש
  const [confirmMode, setConfirmMode] = useState<'cancel' | 'repost' | null>(null)
  const [deleting, setDeleting] = useState(false)
  // ביטול השיבוץ ע"י השמרטפית שתפסה
  const [confirmUnassign, setConfirmUnassign] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const busy = assigning || deleting || unassigning
  const slowAction = useSlowNotice(busy)

  // מנקים את ה-flash מה-history כדי שלא יופיע שוב ברענון
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  // מונה הפעולות המקומיות (טעינה, תפיסה, ביטול שיבוץ). תשובה של העדכון החי שיצאה לפני פעולה כזו
  // יכולה להגיע אחריה עם מצב ישן (למשל "פנויה" אחרי 409) - ואז מתעלמים ממנה.
  const actionSeq = useRef(0)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      actionSeq.current++
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

  // עדכון חי: כל 10 שניות טוענים את הבקשה מחדש בשקט. אם משהו השתנה בגלל מישהו אחר - מסבירים מה קרה.
  // לא מרעננים באמצע פעולה (תפיסה / ביטול), ותשובה שהגיעה אחרי פעולה כזו כבר ישנה - כדי לא לדרוס את התוצאה שלה.
  // שימו לב: גם עם עדכון חי, שמרטפית שלוחצת לפני שהמסך התעדכן תקבל 409 - השרת הוא ההגנה האמיתית.
  const requestRef = useRef(request)
  useEffect(() => {
    requestRef.current = request
  }, [request])
  usePolling(
    async () => {
      if (busy) return
      const seq = actionSeq.current
      try {
        const fresh = await babylinkApi.getRequest(requestId)
        if (seq !== actionSeq.current) return
        const prev = requestRef.current
        if (!prev || sameData(prev, fresh)) return
        const change = describeChange(prev, fresh, user?.id)
        setRequest(fresh)
        if (change) setNotice(change)
      } catch (err) {
        if (isApiError(err) && err.status === 404) {
          setLoadError({ status: 404, message: 'הבקשה כבר לא קיימת.' })
        }
      }
    },
    LIVE_REFRESH_MS,
    !loading && !loadError,
  )

  // ---- תפיסה (שמרטפית) ----
  async function handleAssign() {
    actionSeq.current++
    setNotice(null)
    setAssigning(true)
    try {
      const updated = await babylinkApi.assignRequest(requestId)
      setRequest(updated)
      showNotice({
        kind: 'success',
        title: 'הבקשה שלך!',
        text: 'תפסת את הבקשה בהצלחה. כדאי ליצור קשר עם ההורה ולתאם. אם הבקשה תבוטל - תקבלי על כך הודעה.',
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

  // ---- ביטול השיבוץ (השמרטפית שתפסה) ----
  // הבקשה חוזרת להמתין לשמרטפית, וההורה מקבל הודעה. 409 = הבקשה השתנתה בינתיים (למשל ההורה ביטל).
  async function handleUnassign() {
    actionSeq.current++
    setUnassigning(true)
    try {
      await babylinkApi.unassignRequest(requestId)
      setConfirmUnassign(false)
      await refresh()
      showNotice({ kind: 'success', title: 'השיבוץ בוטל', text: 'ההורה קיבל הודעה, והבקשה חזרה לרשימת הפנויות.' })
    } catch (err) {
      setConfirmUnassign(false)
      showNotice({ kind: 'error', title: 'ביטול השיבוץ נכשל', text: isApiError(err) ? err.message : 'אירעה שגיאה.' })
      // 400 = בינתיים נשארו פחות מ-24 שעות; הרענון חוסם את הכפתור ומציג את ההסבר
      if (isApiError(err) && [400, 404, 409].includes(err.status)) await refresh()
    } finally {
      setUnassigning(false)
    }
  }

  // ---- ביטול (ההורה שפרסם) ----
  // ההורה לא מחויב לשמרטפית שתפסה: אפשר לבטל, ואם רוצים - לפרסם מחדש עם אותם פרטים.
  // אם הבקשה כבר נתפסה, השרת יוצר לשמרטפית הודעה על הביטול.
  async function handleCancel() {
    if (!request || !confirmMode) return
    const repost = confirmMode === 'repost'
    setDeleting(true)
    try {
      await babylinkApi.deleteRequest(requestId)
      const sitterNotified = request.isAssigned ? ' השמרטפית תקבל הודעה על הביטול.' : ''
      if (repost) {
        navigate('/requests/new', {
          replace: true,
          state: {
            repost: toRepost(request),
            repostNotice: `הבקשה הקודמת בוטלה.${sitterNotified} בדקו את הפרטים ופרסמו מחדש.`,
          } satisfies RepostState,
        })
      } else {
        navigate('/requests', { replace: true, state: { flash: `הבקשה בוטלה.${sitterNotified}` } })
      }
    } catch (err) {
      setDeleting(false)
      setConfirmMode(null)
      showNotice({ kind: 'error', title: 'הביטול נכשל', text: isApiError(err) ? err.message : 'אירעה שגיאה.' })
      if (isApiError(err) && err.status === 409) await refresh()
    }
  }

  // "פרסום שוב" של בקשה שמועדה עבר: אותם פרטים, באותו יום ושעה בשבוע הקרוב
  function handleRepostPast() {
    if (!request) return
    const slot = nextWeeklySlot(request.startTimeUtc, request.endTimeUtc)
    navigate('/requests/new', {
      state: {
        repost: { ...toRepost(request), startTimeUtc: slot.startIso, endTimeUtc: slot.endIso },
        repostNotice: `הפרטים הועתקו מהבקשה ל${formatDate(request.startTimeUtc)}, עם אותו מועד בשבוע הקרוב. בדקו ופרסמו.`,
      } satisfies RepostState,
    })
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
            title={
              loadError?.status === 404
                ? 'הבקשה לא נמצאה'
                : loadError?.status === 403
                  ? 'אין לך גישה לבקשה הזו'
                  : 'לא הצלחנו לטעון את הבקשה'
            }
            text={loadError?.status === 404 ? 'ייתכן שהיא בוטלה על ידי ההורה.' : loadError?.message}
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
        {notice?.kind === 'info' && (
          <Alert variant="info" title={notice.title} className="details-notice" onClose={() => setNotice(null)}>
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
            <div className="total-box">
              <span className="total-label">סה"כ לבקשה</span>
              <strong className="total-value">
                {formatCurrency(totalEarnings(request.hourlyRate, request.startTimeUtc, request.endTimeUtc))}
              </strong>
              <span className="total-calc">
                {formatCurrency(request.hourlyRate)} × {formatDuration(request.startTimeUtc, request.endTimeUtc)}
              </span>
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

            {/* השמרטפית שתפסה יכולה לבטל את השיבוץ עד 24 שעות לפני המועד. פחות מזה - הכפתור חסום (גם השרת חוסם) */}
            {isSitter && assignedToMe && !request.isExpired && (
              <>
                <button
                  type="button"
                  className="btn btn-danger-outline btn-block"
                  onClick={() => setConfirmUnassign(true)}
                  disabled={busy || !request.canCancelAssignment}
                >
                  <UserX size={16} />
                  ביטול השיבוץ
                </button>
                {!request.canCancelAssignment && (
                  <div className="state-box state-locked">
                    <Lock size={20} />
                    <div>
                      <strong>אין אפשרות לבטל פחות מ-24 שעות לפני המועד</strong>
                      <span>אם אינך יכולה להגיע, עליך להשיג מחליפה.</span>
                    </div>
                  </div>
                )}
              </>
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

            {/* ההורה: בקשה שמועדה עבר - "פרסום שוב" */}
            {isOwner && request.isExpired && (
              <div className="owner-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={handleRepostPast}>
                  <Repeat size={16} />
                  פרסום שוב
                </button>
                <p className="action-hint">אותם פרטים, באותו יום ושעה בשבוע הקרוב - אפשר לשנות לפני הפרסום.</p>
              </div>
            )}

            {/* ההורה: בקשה עתידית שנתפסה - לא מחויבים לשמרטפית */}
            {isOwner && !request.isExpired && request.isAssigned && (
              <div className="owner-actions">
                <div className="owner-note">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>אתם לא מחויבים לשמרטפית שתפסה</strong>
                    <span>
                      אם היא לא מתאימה לכם - אפשר לבטל את הבקשה ולפרסם אותה מחדש. השמרטפית תקבל הודעה על הביטול.
                    </span>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmMode('repost')}>
                  <RefreshCw size={16} />
                  ביטול ופרסום מחדש
                </button>
                <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmMode('cancel')}>
                  <Trash2 size={16} />
                  ביטול הבקשה
                </button>
                <p className="action-hint">
                  <Lock size={13} /> בקשה שנתפסה לא ניתנת לעריכה.
                </p>
              </div>
            )}

            {/* ההורה: בקשה עתידית שעוד ממתינה לשמרטפית */}
            {isOwner && !request.isExpired && !request.isAssigned && (
              <div className="owner-actions">
                <Link to={`/requests/${request.id}/edit`} className="btn btn-secondary btn-block">
                  <Pencil size={16} />
                  עריכה
                </Link>
                <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmMode('cancel')}>
                  <Trash2 size={16} />
                  ביטול הבקשה
                </button>
              </div>
            )}

            {slowAction && <WakeNote />}
          </section>

          {/* פרטי ההורה - לשמרטפית (להורה עצמו זה מיותר) */}
          {!isOwner && <PersonCard title="ההורה" name={request.parentFullName} phone={request.parentPhone} />}

          {/* את זהות השמרטפית שתפסה השרת מחזיר רק להורה שפרסם ולשמרטפית עצמה. לשאר - פרטים לא מזהים בלבד. */}
          {request.isAssigned &&
            (request.assignedBabysitterFullName ? (
              <PersonCard
                title="השמרטפית שתפסה"
                name={request.assignedBabysitterFullName}
                phone={request.assignedBabysitterPhone}
                highlight
              >
                {request.assignedAtUtc && (
                  <AssignedTime createdAtUtc={request.createdAtUtc} assignedAtUtc={request.assignedAtUtc} />
                )}
              </PersonCard>
            ) : (
              <section className="card card-body person-card">
                <span className="person-title">השמרטפית שתפסה</span>
                <div className="person-row">
                  <span className="person-avatar person-avatar-hidden">
                    <EyeOff size={20} />
                  </span>
                  <div className="person-info">
                    <strong>פרטים חסויים</strong>
                    <span className="person-hint">גלויים רק להורה שפרסם ולשמרטפית שתפסה</span>
                  </div>
                </div>
                {request.assignedAtUtc && (
                  <AssignedTime createdAtUtc={request.createdAtUtc} assignedAtUtc={request.assignedAtUtc} />
                )}
              </section>
            ))}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmMode !== null}
        title={confirmMode === 'repost' ? 'לבטל ולפרסם מחדש?' : 'לבטל את הבקשה?'}
        text={cancelDialogText(request, confirmMode)}
        confirmLabel={confirmMode === 'repost' ? 'כן, לבטל ולפרסם מחדש' : 'כן, לבטל'}
        busy={deleting}
        onConfirm={handleCancel}
        onCancel={() => setConfirmMode(null)}
      />

      <ConfirmDialog
        open={confirmUnassign}
        title="לבטל את השיבוץ?"
        text="ההורה יקבל הודעה, והבקשה תחזור לרשימת הפנויות - שמרטפית אחרת תוכל לתפוס אותה."
        confirmLabel="כן, לבטל את השיבוץ"
        busy={unassigning}
        onConfirm={handleUnassign}
        onCancel={() => setConfirmUnassign(false)}
      />
    </>
  )
}

// ---------- רכיבי עזר קטנים למסך ----------

function cancelDialogText(request: ServiceRequestDetails, mode: 'cancel' | 'repost' | null) {
  const sitter = request.assignedBabysitterFullName ?? 'השמרטפית'
  if (mode === 'repost') {
    return `הבקשה הנוכחית תבוטל, ו${sitter} תקבל הודעה על כך בכניסה הבאה שלה. מיד אחר כך ייפתח טופס עם אותם פרטים, כדי לפרסם אותה מחדש לכל השמרטפיות.`
  }
  return request.isAssigned
    ? `${sitter} תקבל הודעה על הביטול בכניסה הבאה שלה. לא ניתן לבטל את הפעולה.`
    : 'הבקשה תוסר, ושמרטפיות כבר לא יוכלו לתפוס אותה. לא ניתן לבטל את הפעולה.'
}

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

// מתי נתפסה הבקשה, וכמה זמן אחרי שפורסמה - פרטים לא מזהים, גלויים לכולם
function AssignedTime({ createdAtUtc, assignedAtUtc }: { createdAtUtc: string; assignedAtUtc: string }) {
  return (
    <div className="assigned-time">
      <span>
        <Clock size={14} />
        נתפסה ב-{formatDateTime(assignedAtUtc)}
      </span>
      <span>
        <Zap size={14} />
        תוך {formatElapsed(createdAtUtc, assignedAtUtc)} מרגע הפרסום
      </span>
    </div>
  )
}

interface PersonCardProps {
  title: string
  name: string
  phone: string | null
  highlight?: boolean
  children?: ReactNode
}

function PersonCard({ title, name, phone, highlight, children }: PersonCardProps) {
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
      {children}
    </section>
  )
}
