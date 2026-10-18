// סטטוס בקשה: פנויה / נתפסה / הסתיימה (נתפסה ומועדה עבר) / עבר המועד (אף אחת לא תפסה).
interface StatusBadgeProps {
  isAssigned: boolean
  isExpired: boolean
}

export function getStatus({ isAssigned, isExpired }: StatusBadgeProps) {
  if (isAssigned && isExpired) return { key: 'done', label: 'הסתיימה' } as const
  if (isAssigned) return { key: 'assigned', label: 'נתפסה' } as const
  if (isExpired) return { key: 'expired', label: 'עבר המועד' } as const
  return { key: 'available', label: 'פנויה' } as const
}

export default function StatusBadge(props: StatusBadgeProps) {
  const status = getStatus(props)
  return (
    <span className={`badge badge-${status.key}`}>
      <span className="badge-dot" />
      {status.label}
    </span>
  )
}
