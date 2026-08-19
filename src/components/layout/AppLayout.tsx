import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { PageId } from './types'
import type { ReactNode } from 'react'
import './AppLayout.css'

export function AppLayout({
  page,
  onNavigate,
  children,
}: {
  page: PageId
  onNavigate: (id: PageId) => void
  children: ReactNode
}) {
  return (
    <div className="app-layout">
      <Sidebar page={page} onNavigate={onNavigate} />
      <main className="app-layout__main">
        <Header />
        {children}
      </main>
    </div>
  )
}
