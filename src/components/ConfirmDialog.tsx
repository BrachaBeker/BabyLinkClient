// חלון אישור לפעולה הרסנית (מחיקה). Esc או לחיצה על הרקע סוגרים.
import { Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Spinner } from './Loading'

interface ConfirmDialogProps {
  open: boolean
  title: string
  text: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, text, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onCancel()}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-icon">
          <Trash2 size={22} />
        </div>
        <h3 id="confirm-title">{title}</h3>
        <p>{text}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <Spinner />}
            {confirmLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy} ref={cancelRef}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
