import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { OtpInput } from './OtpInput'

function Harness({ onValue }) {
  const [value, setValue] = useState('')
  return (
    <OtpInput
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue(v)
      }}
    />
  )
}

describe('OtpInput', () => {
  it('affiche 6 cases', () => {
    render(<OtpInput value="" onChange={() => {}} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(6)
  })

  it('saisit chiffre par chiffre en ignorant les caractères non numériques', () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    const [first, second] = screen.getAllByRole('textbox')
    fireEvent.change(first, { target: { value: '4' } })
    fireEvent.change(second, { target: { value: 'x' } })
    fireEvent.change(second, { target: { value: '2' } })
    expect(onValue).toHaveBeenLastCalledWith('42')
    expect(document.activeElement).toBe(screen.getAllByRole('textbox')[2])
  })

  it('accepte le collage du code complet', () => {
    const onValue = vi.fn()
    render(<Harness onValue={onValue} />)
    fireEvent.paste(screen.getAllByRole('textbox')[0], { clipboardData: { getData: () => '123 456' } })
    expect(onValue).toHaveBeenLastCalledWith('123456')
    expect(screen.getAllByRole('textbox').map((i) => i.value).join('')).toBe('123456')
  })
})
