import { useRef } from 'react'
import { OTP_LENGTH } from '../lib/constants'

/**
 * Saisie d'un code OTP numérique en cases séparées.
 * Gère la saisie, le retour arrière, les flèches et le collage du code complet.
 */
export function OtpInput({ value, onChange, length = OTP_LENGTH, disabled = false }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focus = (index) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus()

  const update = (index, digit) => {
    const next = digits.slice()
    next[index] = digit
    onChange(next.join('').slice(0, length))
  }

  const handleChange = (index, event) => {
    const input = event.target.value.replace(/\D/g, '')
    if (!input) {
      update(index, '')
      return
    }
    if (input.length > 1) {
      // Saisie automatique / collage dans une case.
      const next = (digits.slice(0, index).join('') + input).slice(0, length)
      onChange(next)
      focus(next.length)
      return
    }
    update(index, input)
    focus(index + 1)
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index]) {
      event.preventDefault()
      update(index - 1, '')
      focus(index - 1)
    } else if (event.key === 'ArrowLeft') {
      focus(index - 1)
    } else if (event.key === 'ArrowRight') {
      focus(index + 1)
    }
  }

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    focus(pasted.length)
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Code de validation">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={`Chiffre ${index + 1}`}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="h-12 w-10 rounded-md border border-steel-200 bg-white text-center text-xl font-bold text-navy-900 shadow-sm focus:border-olive-500 focus:ring-2 focus:ring-olive-500/30 focus:outline-none sm:h-14 sm:w-12"
        />
      ))}
    </div>
  )
}
