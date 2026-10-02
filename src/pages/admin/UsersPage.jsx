import { useMemo, useState } from 'react'
import { OrgSelectors } from '../../components/OrgSelectors'
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { useOrganization } from '../../hooks/useOrganization'
import { ROLE_LABELS } from '../../lib/constants'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
import { deleteUserAccount, fetchProfiles, updateProfile } from '../../services/profiles'

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))
const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente de validation' },
  { value: 'validated', label: 'Validés' },
]

/** Ligne éditable d'un utilisateur. */
function UserRow({ user, org, isSelf, onSaved }) {
  const [draft, setDraft] = useState({
    role: user.role,
    is_validated: user.is_validated,
    regiment_id: user.regiment_id,
    company_id: user.company_id,
    section_id: user.section_id,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dirty = Object.keys(draft).some((key) => draft[key] !== user[key])

  const save = async (changes = draft) => {
    setSaving(true)
    setError(null)
    try {
      await updateProfile(user.id, changes)
      await onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement le compte de ${user.full_name} ?`)) return
    setSaving(true)
    try {
      await deleteUserAccount(user.id)
      await onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-navy-900">
            {user.full_name} {isSelf && <span className="text-xs text-steel-600">(vous)</span>}
          </p>
          <p className="text-xs text-steel-600">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.is_validated ? <Badge tone="olive">Validé</Badge> : <Badge tone="red">En attente</Badge>}
          {!user.is_validated && (
            <Button size="sm" variant="secondary" loading={saving} onClick={() => save({ is_validated: true })}>
              Valider
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-[12rem_1fr_auto]">
        <Select
          aria-label="Rôle"
          value={draft.role}
          options={ROLE_OPTIONS}
          disabled={isSelf}
          onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
        />
        <OrgSelectors org={org} value={draft} compact onChange={(next) => setDraft((d) => ({ ...d, ...next }))} />
        <div className="flex gap-2">
          <Button size="sm" loading={saving} disabled={!dirty} onClick={() => save()}>
            Enregistrer
          </Button>
          {!isSelf && (
            <Button size="sm" variant="outline" disabled={saving} onClick={remove} aria-label={`Supprimer ${user.full_name}`}>
              Supprimer
            </Button>
          )}
        </div>
      </div>
      <Alert tone="error">{error}</Alert>
    </li>
  )
}

/** Gestion des utilisateurs : validation, rôles, rattachement. */
export default function UsersPage() {
  const { profile } = useAuth()
  const { org, loading: orgLoading } = useOrganization()
  const { data: users, error, loading, reload } = useAsync(fetchProfiles)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (users ?? []).filter((u) => {
      if (filter === 'pending' && u.is_validated) return false
      if (filter === 'validated' && !u.is_validated) return false
      if (!term) return true
      return [u.full_name, u.email, u.company?.name, u.section?.name]
        .map((value) => formatOrganizationName(value ?? ''))
        .some((value) => value.toLowerCase().includes(term))
    })
  }, [users, search, filter])

  const pendingCount = (users ?? []).filter((u) => !u.is_validated).length

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle={`${pendingCount} compte(s) en attente de validation`} />
      <Card>
        <div className="mb-2 grid gap-3 sm:grid-cols-[1fr_16rem]">
          <Input
            aria-label="Rechercher"
            placeholder="Rechercher un nom, un email, une unité…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select aria-label="Filtre" value={filter} options={FILTERS} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Alert tone="error">{errorMessage(error)}</Alert>
        {(loading && !users) || orgLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState>Aucun utilisateur.</EmptyState>
        ) : (
          <ul className="divide-y divide-steel-100">
            {filtered.map((user) => (
              <UserRow
                key={`${user.id}-${user.role}-${user.is_validated}-${user.company_id}-${user.section_id}`}
                user={user}
                org={org}
                isSelf={user.id === profile.id}
                onSaved={reload}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
