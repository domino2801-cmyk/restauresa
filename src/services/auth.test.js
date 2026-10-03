import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resetPasswordForEmail } = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail } },
}))

import { requestPasswordReset } from './auth'

describe('requestPasswordReset', () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset().mockResolvedValue({ error: null })
  })

  it('uses the published app when the reset is requested locally', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:5173' },
    })

    await requestPasswordReset('  user@example.com  ')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://domino2801-cmyk.github.io/restauresa/reset-password',
    })
  })

  it('uses the current app URL when the reset is requested from production', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'domino2801-cmyk.github.io', origin: 'https://domino2801-cmyk.github.io' },
    })

    await requestPasswordReset('user@example.com')

    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: `https://domino2801-cmyk.github.io${import.meta.env.BASE_URL}reset-password`,
    })
  })

  it('surfaces errors returned by Supabase', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: new Error('Email service unavailable') })
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', origin: 'http://localhost:5173' },
    })

    await expect(requestPasswordReset('user@example.com')).rejects.toThrow('Email service unavailable')
  })
})
