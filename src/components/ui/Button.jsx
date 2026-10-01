const VARIANTS = {
  primary: 'bg-navy-900 text-white hover:bg-navy-700 disabled:bg-navy-300',
  secondary: 'bg-olive-700 text-white hover:bg-olive-600 disabled:bg-olive-300',
  outline: 'border border-steel-200 bg-white text-navy-900 hover:bg-steel-100 disabled:text-steel-400',
  danger: 'bg-red-700 text-white hover:bg-red-600 disabled:bg-red-300',
  ghost: 'text-navy-900 hover:bg-steel-100 disabled:text-steel-400',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

/** Bouton standard. `loading` désactive le bouton et affiche un indicateur. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-wide transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
