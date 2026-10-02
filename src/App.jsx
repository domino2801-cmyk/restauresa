import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute, PublicOnlyRoute, RoleRedirect } from './components/ProtectedRoute'
import { Spinner } from './components/ui'
import { AuthProvider } from './contexts/AuthContext'
import { ROLES } from './lib/constants'
import { isSupabaseConfigured } from './lib/supabase'
import ConfigMissingPage from './pages/ConfigMissingPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import VerifyOtpPage from './pages/auth/VerifyOtpPage'
import NotFoundPage from './pages/NotFoundPage'
import PendingPage from './pages/PendingPage'

// Interfaces par rôle chargées à la demande (graphiques volumineux).
const MyReservationsPage = lazy(() => import('./pages/user/MyReservationsPage'))
const MealCheckinPage = lazy(() => import('./pages/user/MealCheckinPage'))
const EstablishmentQrPage = lazy(() => import('./pages/admin/EstablishmentQrPage'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const OrganizationPage = lazy(() => import('./pages/admin/OrganizationPage'))
const MealsPage = lazy(() => import('./pages/admin/MealsPage'))
const WeeklyMenusPage = lazy(() => import('./pages/admin/WeeklyMenusPage'))
const AduDashboardPage = lazy(() => import('./pages/adu/AduDashboardPage'))
const CduDashboardPage = lazy(() => import('./pages/cdu/CduDashboardPage'))

/** Table de routage de l'application. */
export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner className="min-h-screen" />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyOtpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pending" element={<PendingPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<RoleRedirect />} />
            <Route path="reservations" element={<MyReservationsPage />} />
            <Route path="checkin" element={<MealCheckinPage />} />

            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="organization" element={<OrganizationPage />} />
                <Route path="meals" element={<MealsPage />} />
                <Route path="menus" element={<WeeklyMenusPage />} />
                <Route path="qr" element={<EstablishmentQrPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute roles={[ROLES.ADU]} />}>
              <Route path="adu" element={<AduDashboardPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={[ROLES.CDU]} />}>
              <Route path="cdu" element={<CduDashboardPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissingPage />
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
