// עטיפה אחידה לשדה בטופס: תווית, השדה עצמו, רמז ושגיאה (מהשרת או מבדיקה מקדימה).
import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  optional?: boolean
  className?: string
  children: ReactNode
}

export default function FormField({ label, htmlFor, error, hint, optional, className = '', children }: FormFieldProps) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label} {optional && <span className="optional">(לא חובה)</span>}
      </label>
      {children}
      {error ? (
        <span className="field-error" id={`${htmlFor}-error`}>
          <AlertCircle size={14} />
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  )
}
