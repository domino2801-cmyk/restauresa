import { Select } from './ui'

/**
 * Sélecteurs en cascade Régiment > Compagnie > Section.
 * `value` : { regiment_id, company_id, section_id } ; `onChange` reçoit la nouvelle valeur.
 * Changer un niveau réinitialise les niveaux inférieurs.
 */
export function OrgSelectors({ org, value, onChange, errors = {}, required = false, disabled = false, compact = false }) {
  const companies = org.companies.filter((c) => c.regiment_id === value.regiment_id)
  const sections = org.sections.filter((s) => s.company_id === value.company_id)
  const toOptions = (list) => list.map((item) => ({ value: item.id, label: item.name }))

  return (
    <div className={compact ? 'grid gap-2 sm:grid-cols-3' : 'space-y-4'}>
      <Select
        label={compact ? undefined : 'Régiment'}
        aria-label="Régiment"
        required={required}
        disabled={disabled}
        value={value.regiment_id ?? ''}
        placeholder="— Régiment —"
        options={toOptions(org.regiments)}
        error={errors.regiment_id}
        onChange={(e) => onChange({ regiment_id: e.target.value || null, company_id: null, section_id: null })}
      />
      <Select
        label={compact ? undefined : 'Compagnie'}
        aria-label="Compagnie"
        required={required}
        disabled={disabled || !value.regiment_id}
        value={value.company_id ?? ''}
        placeholder="— Compagnie —"
        options={toOptions(companies)}
        error={errors.company_id}
        onChange={(e) => onChange({ ...value, company_id: e.target.value || null, section_id: null })}
      />
      <Select
        label={compact ? undefined : 'Section'}
        aria-label="Section"
        required={required}
        disabled={disabled || !value.company_id}
        value={value.section_id ?? ''}
        placeholder="— Section —"
        options={toOptions(sections)}
        error={errors.section_id}
        onChange={(e) => onChange({ ...value, section_id: e.target.value || null })}
      />
    </div>
  )
}
