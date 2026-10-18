// סטטוס בקשה: פנויה / נתפסה / עבר המועד. (בקשה שנתפסה נשארת "נתפסה" גם אחרי שהמועד עבר.)
interface StatusBadgeProps {
  isAssigned: boolean
  isExpired: boolean
}

export function getStatus({ isAssigned, isExpired }: StatusBadgeProps) {
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
