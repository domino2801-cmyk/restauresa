import { useId } from 'react'

const CONTROL =
  'block w-full rounded-md border border-steel-200 bg-white px-3 py-2.5 text-sm text-steel-900 shadow-sm ' +
  'placeholder:text-steel-400 focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30 focus:outline-none ' +
  'disabled:bg-steel-100 disabled:text-steel-400'

function FieldWrapper({ id, label, error, hint, children }) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold tracking-wider text-steel-700 uppercase">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-steel-600">{hint}</p>
      )}
    </div>
  )
}

/** Champ texte avec libellé et message d'erreur accessibles. */
export function Input({ label, error, hint, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <FieldWrapper id={inputId} label={label} error={error} hint={hint}>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`${CONTROL} ${className}`}
        {...props}
      />
    </FieldWrapper>
  )
}

/** Liste déroulante. `options` : [{ value, label }]. */
export function Select({ label, error, hint, options, placeholder, className = '', id, ...props }) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <FieldWrapper id={selectId} label={label} error={error} hint={hint}>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        className={`${CONTROL} ${className}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
}
