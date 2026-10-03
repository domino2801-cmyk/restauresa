import { useState } from 'react'
import { Alert, EmptyState, PageHeader, Select, Spinner } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { useOrganization } from '../../hooks/useOrganization'
import { ROLES } from '../../lib/constants'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'

function CompanySelection({ dashboard: Dashboard, title }) {
  const { org, error, loading } = useOrganization()
  const [companyId, setCompanyId] = useState('')
  const company = org.companies.find((entry) => entry.id === companyId)
  const regiment = org.regiments.find((entry) => entry.id === company?.regiment_id)
  const label = (entry) => [
    org.regiments.find((unit) => unit.id === entry.regiment_id)?.name,
    entry.name,
  ].filter(Boolean).map(formatOrganizationName).join(' — ')

  return (
    <>
      <PageHeader title={`${title} — Administration`} subtitle="Sélectionnez la compagnie à consulter ou à gérer." />
      <Alert tone="error">{errorMessage(error)}</Alert>
      {loading ? <Spinner /> : !error && (
        <>
          <div className="mb-6">
            <Select label="Compagnie" value={companyId} placeholder="— Choisir une compagnie —"
              options={org.companies.map((entry) => ({ value: entry.id, label: label(entry) }))}
              onChange={(event) => setCompanyId(event.target.value)} />
          </div>
          {company
            ? <Dashboard key={company.id} companyContext={{ company_id: company.id, company, regiment }} />
            : <EmptyState>{org.companies.length ? 'Sélectionnez une compagnie.' : 'Aucune compagnie disponible.'}</EmptyState>}
        </>
      )}
    </>
  )
}

export default function AdminCompanyDashboardPage({ dashboard: Dashboard, title }) {
  const { profile } = useAuth()
  return profile.role === ROLES.ADMIN
    ? <CompanySelection dashboard={Dashboard} title={title} />
    : <Dashboard />
}
