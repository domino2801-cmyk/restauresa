import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useOrganization } from '../../hooks/useOrganization'
import AdminCompanyDashboardPage from './AdminCompanyDashboardPage'

vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../hooks/useOrganization', () => ({ useOrganization: vi.fn() }))

function Dashboard({ companyContext }) {
  const [draft, setDraft] = useState('')
  return (
    <>
      <p>{companyContext?.company_id ?? 'Compagnie du compte'}</p>
      <p>{companyContext?.regiment?.name}</p>
      <input aria-label="Brouillon" value={draft} onChange={(event) => setDraft(event.target.value)} />
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ profile: { role: 'admin', company_id: 'own-company' } })
  useOrganization.mockReturnValue({
    org: {
      regiments: [{ id: 'r1', name: 'Régiment A' }, { id: 'r2', name: 'Régiment B' }],
      companies: [
        { id: 'c1', name: '1 CIE', regiment_id: 'r1' },
        { id: 'c2', name: '1 CIE', regiment_id: 'r2' },
      ],
    },
    loading: false,
    error: null,
  })
})

it.each(['ADU', 'CDU'])('permet de choisir toutes les compagnies dans l’onglet %s et réinitialise la vue', (title) => {
  render(<AdminCompanyDashboardPage dashboard={Dashboard} title={title} />)
  expect(screen.getByRole('heading', { name: `${title} — Administration` })).toBeInTheDocument()
  expect(screen.queryByLabelText('Brouillon')).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: /Régiment A/ })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /Régiment B/ })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Compagnie'), { target: { value: 'c1' } })
  expect(screen.getByText('c1')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Brouillon'), { target: { value: 'Ancienne compagnie' } })
  fireEvent.change(screen.getByLabelText('Compagnie'), { target: { value: 'c2' } })
  expect(screen.getByText('c2')).toBeInTheDocument()
  expect(screen.queryByText('c1')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Brouillon')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('Compagnie'), { target: { value: '' } })
  expect(screen.queryByLabelText('Brouillon')).not.toBeInTheDocument()
  expect(useAuth().profile.company_id).toBe('own-company')
})

it.each(['adu', 'cdu'])('conserve la vue habituelle du rôle %s sans sélecteur global', (role) => {
  useAuth.mockReturnValue({ profile: { role } })
  render(<AdminCompanyDashboardPage dashboard={Dashboard} title={role} />)
  expect(screen.getByText('Compagnie du compte')).toBeInTheDocument()
  expect(screen.queryByLabelText('Compagnie')).not.toBeInTheDocument()
  expect(useOrganization).not.toHaveBeenCalled()
})

it('signale une erreur de chargement de l’organisation', () => {
  useOrganization.mockReturnValue({ org: { companies: [], regiments: [] }, error: new Error('Accès refusé') })
  render(<AdminCompanyDashboardPage dashboard={Dashboard} title="ADU" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Accès refusé')
  expect(screen.queryByLabelText('Compagnie')).not.toBeInTheDocument()
})

it('signale une organisation sans compagnie', () => {
  useOrganization.mockReturnValue({ org: { companies: [], regiments: [] }, loading: false })
  render(<AdminCompanyDashboardPage dashboard={Dashboard} title="CDU" />)
  expect(screen.getByText('Aucune compagnie disponible.')).toBeInTheDocument()
})
