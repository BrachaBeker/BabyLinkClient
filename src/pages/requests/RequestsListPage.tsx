// מסך 2: רשימת הבקשות, עם לשוניות לפי תפקיד, ו-Pagination.
// שמרטפית: "פנויות" (ברירת מחדל) ו"השיבוצים שלי" (עם לוח השבוע הקרוב), כולל סינון ומיון.
// הורה: רק הבקשות שלו (השרת אוכף), בשלוש לשוניות לפי סטטוס - בלי סינון לפי עיר וכו'.
// הלשונית והסינון נשמרים ב-URL (?view=mine&city=...), כך שרענון או חזרה ממסך הפרטים שומרים עליהם.
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarCheck,
  History,
  Hourglass,
  MapPin,
  Plus,
  RotateCcw,
  SearchX,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { babylinkApi } from '../../api/babylink'
import { isApiError } from '../../api/client'
import type { PagedResult, RequestStatus, ServiceRequestListItem, ServiceRequestQuery } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import { LoadingState, Spinner } from '../../components/Loading'
import Pagination from '../../components/Pagination'
import { LIVE_REFRESH_MS, sameData, usePolling } from '../../hooks/usePolling'
import { useTags } from '../../hooks/useTags'
import RequestCard from './RequestCard'
import WeekSchedule from './WeekSchedule'
import './requests.css'

const PAGE_SIZE = 9
const DEBOUNCE_MS = 400

type View = 'available' | 'mine' | RequestStatus

interface ViewConfig {
  value: View
  label: string
  Icon: LucideIcon
  emptyTitle: string
  emptyText: string
}

const SITTER_VIEWS: ViewConfig[] = [
  {
    value: 'available',
    label: 'פנויות',
    Icon: Sparkles,
    emptyTitle: 'אין כרגע בקשות פנויות',
    emptyText: 'כשהורים יפרסמו בקשות חדשות - הן יופיעו כאן.',
  },
  {
    value: 'mine',
    label: 'השיבוצים שלי',
    Icon: CalendarCheck,
    emptyTitle: 'עדיין לא תפסת בקשות',
    emptyText: 'בקשות שתתפסי יופיעו כאן ובלוח השבוע.',
  },
]

const PARENT_VIEWS: ViewConfig[] = [
  {
    value: 'open',
    label: 'ממתינות לשמרטפית',
    Icon: Hourglass,
    emptyTitle: 'אין בקשות שממתינות לשמרטפית',
    emptyText: 'פרסמו בקשה חדשה, והיא תופיע כאן עד ששמרטפית תתפוס אותה.',
  },
  {
    value: 'assigned',
    label: 'נמצאה שמרטפית',
    Icon: UserCheck,
    emptyTitle: 'עוד אין בקשות שנתפסו',
    emptyText: 'כששמרטפית תתפוס בקשה שלכם - היא תופיע כאן.',
  },
  {
    value: 'past',
    label: 'היסטוריה',
    Icon: History,
    emptyTitle: 'אין עדיין היסטוריה',
    emptyText: 'בקשות שהמועד שלהן עבר יופיעו כאן.',
  },
]

function positiveNumber(value: string | null) {
  const n = value ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

// הלשונית מה-URL (?view=...). ערך לא מוכר - הלשונית הראשונה של התפקיד.
function readView(params: URLSearchParams, isParent: boolean): View {
  const views = isParent ? PARENT_VIEWS : SITTER_VIEWS
  return views.find((v) => v.value === params.get('view'))?.value ?? views[0].value
}

// URL -> פרמטרים לשרת
function readQuery(params: URLSearchParams, isParent: boolean): ServiceRequestQuery {
  const view = readView(params, isParent)
  const page = positiveNumber(params.get('page')) ?? 1

  // הורה: הסטטוס של הלשונית, הקרובות קודם (ובהיסטוריה - האחרונות קודם)
  if (isParent) {
    return { status: view as RequestStatus, sortBy: 'startTime', descending: view === 'past', page, pageSize: PAGE_SIZE }
  }

  const onlyAvailable = view === 'available'
  return {
    city: params.get('city') ?? undefined,
    street: params.get('street') ?? undefined,
    tagId: positiveNumber(params.get('tag')),
    minHourlyRate: positiveNumber(params.get('minRate')),
    onlyAvailable,
    mine: view === 'mine',
    // בקשה פנויה תמיד עתידית, ולכן "כולל עבר" לא רלוונטי לה
    includePast: !onlyAvailable && params.get('past') === '1',
    sortBy: params.get('sort') === 'hourlyRate' ? 'hourlyRate' : 'startTime',
    descending: params.get('desc') === '1',
    page,
    pageSize: PAGE_SIZE,
  }
}

export default function RequestsListPage() {
  const { user } = useAuth()
  const isParent = user?.role === 'Parent'
  const { tags } = useTags()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const views = isParent ? PARENT_VIEWS : SITTER_VIEWS
  const view = readView(params, isParent)
  const currentView = views.find((v) => v.value === view) ?? views[0]
  const query = readQuery(params, isParent)
  const queryKey = params.toString()

  // שדות טקסט - מקומיים, ומתעדכנים ב-URL אחרי הפסקה קצרה בהקלדה (debounce)
  const [cityInput, setCityInput] = useState(params.get('city') ?? '')
  const [streetInput, setStreetInput] = useState(params.get('street') ?? '')
  const [minRateInput, setMinRateInput] = useState(params.get('minRate') ?? '')

  const [data, setData] = useState<PagedResult<ServiceRequestListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // הודעה שהגיעה ממסך אחר (למשל "הבקשה בוטלה")
  const [flash, setFlash] = useState<string | null>(
    (location.state as { flash?: string } | null)?.flash ?? null,
  )
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  function updateParams(updates: Record<string, string | undefined>, resetPage = true) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const city = cityInput.trim()
      const street = streetInput.trim()
      const minRate = minRateInput.trim()
      if (
        city !== (params.get('city') ?? '') ||
        street !== (params.get('street') ?? '') ||
        minRate !== (params.get('minRate') ?? '')
      ) {
        updateParams({ city, street, minRate })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityInput, streetInput, minRateInput])

  // טעינת הנתונים מהשרת בכל שינוי ב-URL. AbortController מבטל בקשה ישנה אם המשתמש ממשיך לשנות.
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    babylinkApi
      .getRequests(readQuery(new URLSearchParams(queryKey), isParent), controller.signal)
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(isApiError(err) ? err.message : 'לא ניתן לטעון את הבקשות.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [queryKey, reloadKey, isParent])

  // עדכון חי: כל 10 שניות טוענים שוב בשקט (בלי ספינר), ומעדכנים רק אם משהו השתנה -
  // כך כרטיס שנתפס מתחלף ל"נתפסה", ובקשה חדשה מופיעה, בלי לרענן את הדף.
  // אם בינתיים השתנו הסינון או העמוד - מתעלמים מהתשובה הישנה.
  const queryKeyRef = useRef(queryKey)
  useEffect(() => {
    queryKeyRef.current = queryKey
  }, [queryKey])
  usePolling(
    async () => {
      const key = queryKeyRef.current
      const result = await babylinkApi.getRequests(readQuery(new URLSearchParams(key), isParent))
      if (key !== queryKeyRef.current) return
      setData((prev) => (sameData(prev, result) ? prev : result))
    },
    LIVE_REFRESH_MS,
    !loading && !error,
  )

  // אם העמוד הנוכחי כבר לא קיים (למשל אחרי ביטול) - עוברים לעמוד האחרון
  useEffect(() => {
    if (data && data.items.length === 0 && data.totalPages > 0 && data.page > data.totalPages) {
      updateParams({ page: String(data.totalPages) }, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const hasFilters = !isParent && ['city', 'street', 'tag', 'minRate', 'past'].some((key) => params.has(key))

  // הלשונית היא ניווט ולא סינון - "ניקוי" משאיר אותה
  function resetFilters() {
    setCityInput('')
    setStreetInput('')
    setMinRateInput('')
    const next = new URLSearchParams()
    const current = params.get('view')
    if (current) next.set('view', current)
    setParams(next, { replace: true })
  }

  function changeView(value: View) {
    const isDefault = value === views[0].value
    updateParams({
      view: isDefault ? undefined : value,
      ...(value === 'available' ? { past: undefined } : {}),
    })
  }

  function changePage(page: number) {
    updateParams({ page: page > 1 ? String(page) : undefined }, false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const firstLoad = loading && !data

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isParent ? 'הבקשות שלי' : 'בקשות שמרטפות'}</h1>
          <p className="page-subtitle">
            {isParent
              ? 'פרסמו בקשה חדשה ועקבו אחרי הבקשות שלכם.'
              : 'מצאי בקשה שמתאימה לך ולחצי "אני לוקחת" - הראשונה שתופסת זוכה.'}
          </p>
        </div>
        {isParent && (
          <Link to="/requests/new" className="btn btn-primary">
            <Plus size={18} />
            בקשה חדשה
          </Link>
        )}
      </div>

      {flash && (
        <Alert variant="success" onClose={() => setFlash(null)} className="list-flash">
          {flash}
        </Alert>
      )}

      <div className="view-tabs" role="tablist" aria-label="תצוגת הבקשות">
        {views.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            className={`view-tab ${view === value ? 'active' : ''}`}
            onClick={() => changeView(value)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ---- סינון ומיון (לשמרטפית בלבד - להורה יש רק את הבקשות שלו) ---- */}
      {!isParent && (
        <section className="card filters" aria-label="סינון ומיון">
          <div className="filters-grid">
            <div className="field">
              <label className="field-label" htmlFor="f-city">
                עיר
              </label>
              <input
                id="f-city"
                className="input"
                placeholder="כל הערים"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="f-street">
                רחוב
              </label>
              <input
                id="f-street"
                className="input"
                placeholder="כל הרחובות"
                value={streetInput}
                onChange={(e) => setStreetInput(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="f-tag">
                תגית
              </label>
              <select
                id="f-tag"
                className="select"
                value={params.get('tag') ?? ''}
                onChange={(e) => updateParams({ tag: e.target.value })}
              >
                <option value="">כל התגיות</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="f-rate">
                תעריף מינימלי לשעה
              </label>
              <input
                id="f-rate"
                className="input"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="₪ ללא מינימום"
                value={minRateInput}
                onChange={(e) => setMinRateInput(e.target.value)}
              />
            </div>
          </div>

          <div className="filters-bar">
            <div className="toggle-group">
              {/* בלשונית "פנויות" אין בקשות שעבר זמנן */}
              {view === 'mine' && (
                <button
                  type="button"
                  className={`toggle-chip ${query.includePast ? 'on' : ''}`}
                  aria-pressed={query.includePast}
                  onClick={() => updateParams({ past: query.includePast ? undefined : '1' })}
                >
                  כולל שיבוצים שעבר זמנם
                </button>
              )}
              {hasFilters && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
                  <RotateCcw size={15} />
                  ניקוי
                </button>
              )}
            </div>

            <div className="sort-controls">
              <label className="sort-label" htmlFor="f-sort">
                מיון:
              </label>
              <select
                id="f-sort"
                className="select select-sm"
                value={query.sortBy}
                onChange={(e) => updateParams({ sort: e.target.value === 'hourlyRate' ? 'hourlyRate' : undefined })}
              >
                <option value="startTime">לפי מועד</option>
                <option value="hourlyRate">לפי תעריף</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => updateParams({ desc: query.descending ? undefined : '1' })}
                title="החלפת כיוון המיון"
              >
                {query.descending ? <ArrowDownWideNarrow size={16} /> : <ArrowUpNarrowWide size={16} />}
                {query.descending ? 'יורד' : 'עולה'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---- תוצאות ---- */}
      {error ? (
        <Alert variant="error" title="לא הצלחנו לטעון את הבקשות">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary btn-sm retry-btn" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcw size={15} />
            נסו שוב
          </button>
        </Alert>
      ) : firstLoad ? (
        <LoadingState text="טוען בקשות..." />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          {hasFilters ? (
            <EmptyState
              Icon={SearchX}
              title="לא נמצאו בקשות"
              text="נסו לשנות או לנקות את הסינון."
              action={
                <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                  ניקוי הסינון
                </button>
              }
            />
          ) : (
            <EmptyState
              Icon={currentView.Icon}
              title={currentView.emptyTitle}
              text={currentView.emptyText}
              action={
                isParent &&
                view === 'open' && (
                  <Link to="/requests/new" className="btn btn-primary">
                    <Plus size={18} />
                    בקשה חדשה
                  </Link>
                )
              }
            />
          )}
        </div>
      ) : (
        data && (
          <>
            <div className="results-head">
              <span>
                <MapPin size={15} />
                נמצאו <strong>{data.totalCount}</strong> בקשות
              </span>
              {loading && (
                <span className="results-loading">
                  <Spinner />
                  מעדכן...
                </span>
              )}
            </div>
            <div className={`request-grid ${loading ? 'is-refreshing' : ''}`}>
              {data.items.map((item) => (
                <RequestCard key={item.id} request={item} />
              ))}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} disabled={loading} onChange={changePage} />
          </>
        )
      )}

      {/* לוח השבוע הקרוב - מתחת לכרטיסים, בלשונית "השיבוצים שלי" */}
      {!isParent && view === 'mine' && <WeekSchedule />}
    </>
  )
}
