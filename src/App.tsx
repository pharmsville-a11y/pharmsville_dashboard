import { useEffect, useState } from 'react'
import { AuthProvider, canAccessPage, canAccessLocalDevPage, isLocalDevOnlyPage, useAuth, DevLabAccessProvider, useDevLabAccess } from './auth'
import { AppLayout } from './components/layout/AppLayout'
import { PageLoadProvider } from './components/layout/PageLoadContext'
import type { PageId } from './components/layout/types'
import { NavConfigProvider, useNavConfig } from './nav/NavConfigProvider'
import { AccountsPage } from './pages/AccountsPage'
import { CommercePage } from './pages/CommercePage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { MenuSettingsPage } from './pages/MenuSettingsPage'
import { PlaceholderPage, type PlaceholderPageId } from './pages/PlaceholderPage'
import { PageTestPage } from './pages/PageTestPage'
import { DevLabPage } from './pages/DevLabPage'
import { ApiCheckPage } from './pages/ApiCheckPage'
import { StockPage } from './pages/StockPage'

function Shell() {
  const { user } = useAuth()
  const { config } = useNavConfig()
  const { allowed: localDevAllowed } = useDevLabAccess()
  const [page, setPage] = useState<PageId>('dashboard')

  useEffect(() => {
    if (!user) return
    if (isLocalDevOnlyPage(page)) {
      if (!canAccessLocalDevPage(page, localDevAllowed)) setPage('dashboard')
      return
    }
    if (!canAccessPage(user.role, page, config)) setPage('dashboard')
  }, [config, localDevAllowed, page, user])

  if (!user) return <LoginPage />

  const activePage = isLocalDevOnlyPage(page)
    ? canAccessLocalDevPage(page, localDevAllowed)
      ? page
      : 'dashboard'
    : canAccessPage(user.role, page, config)
      ? page
      : 'dashboard'

  return (
    <AppLayout page={activePage} onNavigate={setPage}>
      {activePage === 'dashboard' ? (
        <DashboardPage
          key="sales"
          onOpenMarketing={
            canAccessPage(user.role, 'marketing', config) ? () => setPage('marketing') : undefined
          }
        />
      ) : activePage === 'marketing' ? (
        <DashboardPage key="ads" mode="ads" />
      ) : activePage === 'accounts' ? (
        <AccountsPage />
      ) : activePage === 'menu' ? (
        <MenuSettingsPage />
      ) : activePage === 'commerce' ? (
        <CommercePage />
      ) : activePage === 'stock' ? (
        <StockPage />
      ) : activePage === 'pagetest' ? (
        <PageTestPage />
      ) : activePage === 'devlab' ? (
        <DevLabPage />
      ) : activePage === 'apicheck' ? (
        <ApiCheckPage />
      ) : (
        <PlaceholderPage page={activePage as PlaceholderPageId} />
      )}
    </AppLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <DevLabAccessProvider>
        <NavConfigProvider>
          <PageLoadProvider>
            <Shell />
          </PageLoadProvider>
        </NavConfigProvider>
      </DevLabAccessProvider>
    </AuthProvider>
  )
}
