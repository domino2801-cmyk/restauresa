/**
 * Génération et téléchargement de fichiers CSV (séparateur « ; » pour Excel FR).
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/

/** Échappe une cellule CSV et neutralise l'injection de formules tableur. */
export function escapeCell(value) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (FORMULA_PREFIX.test(text)) text = `'${text}`
  if (/[";\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

/**
 * Construit un CSV à partir d'en-têtes et de lignes.
 * @param {string[]} headers
 * @param {Array<Array<unknown>>} rows
 */
export function toCSV(headers, rows) {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n')
}

/** Déclenche le téléchargement d'un CSV dans le navigateur (BOM UTF-8 inclus). */
export function downloadCSV(filename, csv) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
