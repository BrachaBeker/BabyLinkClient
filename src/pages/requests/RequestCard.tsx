// כרטיס בקשה ברשימה. כל הכרטיס הוא קישור למסך הפרטים.
import { ArrowLeft, Clock, MapPin, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ServiceRequestListItem } from '../../api/types'
import StatusBadge, { getStatus } from '../../components/StatusBadge'
import {
  childrenLabel,
  formatCurrency,
  formatDayNumber,
  formatDuration,
  formatMonthShort,
  formatRelativeDay,
  formatTimeRange,
} from '../../utils/format'

export default function RequestCard({ request }: { request: ServiceRequestListItem }) {
  const status = getStatus(request)

  return (
    <Link to={`/requests/${request.id}`} className={`request-card status-${status.key}`}>
      <div className="rc-head">
        <div className="rc-date" aria-hidden="true">
          <span className="rc-day">{formatDayNumber(request.startTimeUtc)}</span>
          <span className="rc-month">{formatMonthShort(request.startTimeUtc)}</span>
        </div>
        <div className="rc-when">
          <strong>{formatRelativeDay(request.startTimeUtc)}</strong>
          <span>{formatTimeRange(request.startTimeUtc, request.endTimeUtc)}</span>
        </div>
        <StatusBadge isAssigned={request.isAssigned} isExpired={request.isExpired} />
      </div>

      <div className="rc-body">
        <div className="rc-place">
          <MapPin size={17} />
          {request.street}, {request.city}
        </div>
        <div className="rc-meta">
          <span>
            <Users size={15} />
            {childrenLabel(request.childrenCount)}
          </span>
          <span>
            <Clock size={15} />
            {formatDuration(request.startTimeUtc, request.endTimeUtc)}
          </span>
        </div>
        {request.tagNames.length > 0 && (
          <div className="tag-list">
            {request.tagNames.map((name) => (
              <span key={name} className="tag">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rc-foot">
        <div className="rc-rate">
          {formatCurrency(request.hourlyRate)}
          <small>לשעה</small>
        </div>
        <span className="rc-cta">
          לפרטים
          <ArrowLeft size={16} />
        </span>
      </div>
    </Link>
  )
}
