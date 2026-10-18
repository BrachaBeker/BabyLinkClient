import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type AlertVariant = 'error' | 'success' | 'warning' | 'info'

interface AlertProps {
  variant: AlertVariant
  title?: string
  children?: ReactNode
  onClose?: () => void
  className?: string
}

const ICONS = {
  error: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
}

export default function Alert({ variant, title, children, onClose, className = '' }: AlertProps) {
  const Icon = ICONS[variant]
  return (
    <div className={`alert alert-${variant} ${className}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon size={20} />
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="סגירה">
          <X size={18} />
        </button>
      )}
    </div>
  )
}
