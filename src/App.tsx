import { useEffect, useState } from 'react'
import { AuthProvider, canAccessPage, useAuth } from './auth'
import { AppLayout } from './components/layout/AppLayout'
import type { PageId } from './components/layout/types'
import { AccountsPage } from './pages/AccountsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage, type PlaceholderPageId } from './pages/PlaceholderPage'

function Shell() {
  const { user } = useAuth()
  const [page, setPage] = useState<PageId>('dashboard')

  useEffect(() => {
    if (!user) return
    if (!canAccessPage(user.role, page)) setPage('dashboard')
  }, [page, user])

  if (!user) return <LoginPage />

  const activePage = canAccessPage(user.role, page) ? page : 'dashboard'

  return (
    <AppLayout page={activePage} onNavigate={setPage}>
      {activePage === 'dashboard' ? (
        <DashboardPage />
      ) : activePage === 'accounts' ? (
        <AccountsPage />
      ) : (
        <PlaceholderPage page={activePage as PlaceholderPageId} />
      )}
    </AppLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
