import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  disabled?: boolean
  onChange: (page: number) => void
}

// בממשק RTL "הקודם" מימין (חץ ימינה) ו"הבא" משמאל (חץ שמאלה).
export default function Pagination({ page, totalPages, disabled, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="ניווט בין עמודים">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        <ChevronRight size={16} />
        הקודם
      </button>
      <span className="pagination-info">
        עמוד <strong>{page}</strong> מתוך <strong>{totalPages}</strong>
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        הבא
        <ChevronLeft size={16} />
      </button>
    </nav>
  )
}
