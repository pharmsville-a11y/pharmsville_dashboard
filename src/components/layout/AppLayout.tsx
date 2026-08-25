import { useLayoutEffect, type ReactNode } from 'react'
import { Header } from './Header'
import { HourlyUpdateToast } from './HourlyUpdateToast'
import { PageLoadBar } from './PageLoadBar'
import { usePageLoad } from './PageLoadContext'
import { Sidebar } from './Sidebar'
import type { PageId } from './types'
import './AppLayout.css'

const INSTANT_PAGES: ReadonlySet<PageId> = new Set([
  'channels',
  'commerce',
  'settlement',
  'reports',
  'tutorial',
  'accounts',
])

export function AppLayout({
  page,
  onNavigate,
  children,
}: {
  page: PageId
  onNavigate: (id: PageId) => void
  children: ReactNode
}) {
  const { begin } = usePageLoad()

  useLayoutEffect(() => {
    if (INSTANT_PAGES.has(page)) return
    begin()
  }, [begin, page])

  return (
    <div className="app-layout">
      <PageLoadBar />
      <Sidebar page={page} onNavigate={onNavigate} />
      <main className="app-layout__main">
        <Header page={page} />
        {children}
      </main>
      <HourlyUpdateToast />
    </div>
  )
}
