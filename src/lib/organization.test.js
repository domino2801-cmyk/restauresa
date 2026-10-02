import { describe, expect, it } from 'vitest'
import { formatOrganizationName } from './organization'

describe('formatOrganizationName', () => {
  it('abrège les unités demandées sans changer les autres noms', () => {
    expect(formatOrganizationName("1er régiment d'infanterie")).toBe('1er RI')
    expect(formatOrganizationName('Compagnie de soutien')).toBe('CIE de soutien')
    expect(formatOrganizationName('Sections 1 et 2')).toBe('SECT 1 et 2')
    expect(formatOrganizationName('3e régiment')).toBe('3e régiment')
  })
})
