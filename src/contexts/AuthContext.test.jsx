import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { PublicOnlyRoute } from '../components/ProtectedRoute'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'

const mocks = vi.hoisted(() => ({
  callback: null,
  getSession: vi.fn(),
  fetchProfile: vi.fn(),
  updatePassword: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: vi.fn((callback) => {
        mocks.callback = callback
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
      }),
    },
  },
}))
vi.mock('../services/profiles', () => ({ fetchProfile: mocks.fetchProfile }))
vi.mock('../services/auth', () => ({ updatePassword: mocks.updatePassword, signOut: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  mocks.fetchProfile.mockResolvedValue({ id: 'u1', role: 'user', is_validated: true })
  mocks.updatePassword.mockResolvedValue(undefined)
})

function renderRecovery() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<p>Connexion</p>} />
          </Route>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<p>Accueil</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function beginRecovery() {
  await screen.findByText('Connexion')
  await act(async () => {
    mocks.callback('PASSWORD_RECOVERY', { user: { id: 'u1' } })
  })
  await screen.findByLabelText('Nouveau mot de passe')
}

describe('récupération du mot de passe', () => {
  it('ouvre le formulaire après le retour Supabase sur la connexion et termine après enregistrement', async () => {
    renderRecovery()
    await beginRecovery()
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'NewPassword123' } })
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'NewPassword123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Accueil')
    expect(mocks.updatePassword).toHaveBeenCalledWith('NewPassword123')
  })

  it('conserve la récupération après un échec puis autorise un nouvel essai', async () => {
    mocks.updatePassword.mockRejectedValueOnce(new Error('Enregistrement impossible'))
    renderRecovery()
    await beginRecovery()
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'NewPassword123' } })
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'NewPassword123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Enregistrement impossible')
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Accueil')
  })
})
