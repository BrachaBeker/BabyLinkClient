// מסך 2: רשימת הבקשות עם סינון, מיון ו-Pagination.
// מצב הסינון נשמר ב-URL (?city=...&page=2), כך שרענון או חזרה ממסך הפרטים שומרים עליו.
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Inbox, MapPin, Plus, RotateCcw, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { babylinkApi } from '../../api/babylink'
import { isApiError } from '../../api/client'
import type { PagedResult, ServiceRequestListItem, ServiceRequestQuery } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import Alert from '../../components/Alert'
import EmptyState from '../../components/EmptyState'
import { LoadingState, Spinner } from '../../components/Loading'
import Pagination from '../../components/Pagination'
import { useTags } from '../../hooks/useTags'
import RequestCard from './RequestCard'
import './requests.css'

const PAGE_SIZE = 9
const DEBOUNCE_MS = 400

function positiveNumber(value: string | null) {
  const n = value ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

// URL -> פרמטרים לשרת
function readQuery(params: URLSearchParams): ServiceRequestQuery {
  return {
    city: params.get('city') ?? undefined,
    street: params.get('street') ?? undefined,
    tagId: positiveNumber(params.get('tag')),
    minHourlyRate: positiveNumber(params.get('minRate')),
    onlyAvailable: params.get('available') === '1',
    mine: params.get('mine') === '1',
    sortBy: params.get('sort') === 'hourlyRate' ? 'hourlyRate' : 'startTime',
    descending: params.get('desc') === '1',
    page: positiveNumber(params.get('page')) ?? 1,
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
  const query = readQuery(params)
  const queryKey = params.toString()

  // שדות טקסט - מקומיים, ומתעדכנים ב-URL אחרי הפסקה קצרה בהקלדה (debounce)
  const [cityInput, setCityInput] = useState(params.get('city') ?? '')
  const [streetInput, setStreetInput] = useState(params.get('street') ?? '')
  const [minRateInput, setMinRateInput] = useState(params.get('minRate') ?? '')

  const [data, setData] = useState<PagedResult<ServiceRequestListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // הודעה שהגיעה ממסך אחר (למשל "הבקשה נמחקה")
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
      .getRequests(readQuery(new URLSearchParams(queryKey)), controller.signal)
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
  }, [queryKey, reloadKey])

  // אם העמוד הנוכחי כבר לא קיים (למשל אחרי מחיקה) - עוברים לעמוד האחרון
  useEffect(() => {
    if (data && data.items.length === 0 && data.totalPages > 0 && data.page > data.totalPages) {
      updateParams({ page: String(data.totalPages) }, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const hasFilters = ['city', 'street', 'tag', 'minRate', 'available', 'mine'].some((key) => params.has(key))

  function resetFilters() {
    setCityInput('')
    setStreetInput('')
    setMinRateInput('')
    setParams(new URLSearchParams(), { replace: true })
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
          <h1 className="page-title">בקשות שמרטפות</h1>
          <p className="page-subtitle">
            {isParent
              ? 'פרסמו בקשה חדשה, או עקבו אחרי הבקשות שלכם.'
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

      {/* ---- סינון ומיון ---- */}
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
            <button
              type="button"
              className={`toggle-chip ${query.onlyAvailable ? 'on' : ''}`}
              aria-pressed={query.onlyAvailable}
              onClick={() =>
                // לשמרטפית "השיבוצים שלי" = בקשות שכבר תפסה, כך שהן אף פעם לא פנויות - הסינונים בלעדיים.
                // להורה השילוב הגיוני: הבקשות שלי שעוד לא נתפסו.
                updateParams({
                  available: query.onlyAvailable ? undefined : '1',
                  ...(!isParent && !query.onlyAvailable ? { mine: undefined } : {}),
                })
              }
            >
              רק פנויות
            </button>
            <button
              type="button"
              className={`toggle-chip ${query.mine ? 'on' : ''}`}
              aria-pressed={query.mine}
              onClick={() =>
                updateParams({
                  mine: query.mine ? undefined : '1',
                  ...(!isParent && !query.mine ? { available: undefined } : {}),
                })
              }
            >
              {isParent ? 'הבקשות שלי' : 'השיבוצים שלי'}
            </button>
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
              Icon={Inbox}
              title="אין עדיין בקשות"
              text={isParent ? 'פרסמו את הבקשה הראשונה שלכם.' : 'כשהורים יפרסמו בקשות - הן יופיעו כאן.'}
              action={
                isParent && (
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
    </>
  )
}
