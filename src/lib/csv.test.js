import { escapeCell, toCSV } from './csv'

describe('csv', () => {
  it('échappe les séparateurs, guillemets et retours à la ligne', () => {
    expect(escapeCell('a;b')).toBe('"a;b"')
    expect(escapeCell('dit "oui"')).toBe('"dit ""oui"""')
    expect(escapeCell(null)).toBe('')
  })

  it("neutralise l'injection de formules", () => {
    expect(escapeCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(escapeCell('-2+3')).toBe("'-2+3")
  })

  it('assemble en-têtes et lignes', () => {
    expect(toCSV(['Nom', 'Section'], [['Durand', '1re Section']])).toBe('Nom;Section\r\nDurand;1re Section')
  })
})
