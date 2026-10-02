import { useState } from 'react'
import { Alert, Button, Card, EmptyState, Input, PageHeader, Spinner } from '../../components/ui'
import { useOrganization } from '../../hooks/useOrganization'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
import { createUnit, deleteUnit } from '../../services/organization'

/** Colonne d'une liste d'unités avec ajout / suppression. */
function UnitColumn({ title, items, selectedId, onSelect, onCreate, onDelete, disabledReason }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      if (await onCreate(name)) setName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={title}>
      {disabledReason ? (
        <EmptyState>{disabledReason}</EmptyState>
      ) : (
        <>
          <form onSubmit={submit} className="mb-3 flex gap-2">
            <Input aria-label={`Nouveau : ${title}`} placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>
              Ajouter
            </Button>
          </form>
          {items.length === 0 ? (
            <EmptyState>Aucun élément.</EmptyState>
          ) : (
            <ul className="divide-y divide-steel-100">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect?.(item.id)}
                    className={`flex-1 rounded px-2 py-1.5 text-left text-sm ${
                      selectedId === item.id ? 'bg-navy-900 font-semibold text-white' : 'hover:bg-steel-100'
                    }`}
                  >
                    {formatOrganizationName(item.name)}
                  </button>
                  <Button size="sm" variant="ghost" aria-label={`Supprimer ${item.name}`} onClick={() => onDelete(item)}>
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

/** Gestion de l'organisation : régiments > compagnies > sections. */
export default function OrganizationPage() {
  const { org, loading, error: loadError, reload } = useOrganization()
  const [regimentId, setRegimentId] = useState(null)
  const [companyId, setCompanyId] = useState(null)
  const [error, setError] = useState(null)

  const run = async (action) => {
    setError(null)
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    }
  }

  const confirmDelete = (kind, item, after) =>
    window.confirm(`Supprimer « ${formatOrganizationName(item.name)} » et toutes ses sous-unités ?`) &&
    run(async () => {
      await deleteUnit(kind, item.id)
      after?.()
    })

  if (loading && org.regiments.length === 0) return <Spinner />

  return (
    <>
      <PageHeader title="Organisation" subtitle="Régiments · CIE · SECT" />
      <Alert tone="error" className="mb-4">
        {error ?? errorMessage(loadError)}
      </Alert>
      <div className="grid gap-4 md:grid-cols-3">
        <UnitColumn
          title="Régiments"
          items={org.regiments}
          selectedId={regimentId}
          onSelect={(id) => {
            setRegimentId(id)
            setCompanyId(null)
          }}
          onCreate={(name) => run(() => createUnit('regiment', name))}
          onDelete={(item) => confirmDelete('regiment', item, () => item.id === regimentId && setRegimentId(null))}
        />
        <UnitColumn
          title="CIE"
          items={org.companies.filter((c) => c.regiment_id === regimentId)}
          selectedId={companyId}
          onSelect={setCompanyId}
          disabledReason={!regimentId && 'Sélectionnez un régiment.'}
          onCreate={(name) => run(() => createUnit('company', name, { regiment_id: regimentId }))}
          onDelete={(item) => confirmDelete('company', item, () => item.id === companyId && setCompanyId(null))}
        />
        <UnitColumn
          title="SECT"
          items={org.sections.filter((s) => s.company_id === companyId)}
          disabledReason={!companyId && 'Sélectionnez une CIE.'}
          onCreate={(name) => run(() => createUnit('section', name, { company_id: companyId }))}
          onDelete={(item) => confirmDelete('section', item)}
        />
      </div>
    </>
  )
}
