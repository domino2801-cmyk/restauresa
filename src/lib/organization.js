/** Abbreviations displayed in the user-facing organization labels. */
export function formatOrganizationName(name = '') {
  return name
    .replace(/\b1er régiment d'infanterie\b/gi, '1er RI')
    .replace(/\bcompagnies?\b/gi, 'CIE')
    .replace(/\bsections?\b/gi, 'SECT')
}
