import { useEffect, useMemo, useState } from 'react'
import { KpiAlertCard } from '../components/page-test/KpiAlertCard'
import { KpiInventoryCard } from '../components/page-test/KpiInventoryCard'
import { KpiSalesCard } from '../components/page-test/KpiSalesCard'
import { InventoryTrendChart } from '../components/page-test/InventoryTrendChart'
import { SalesRankChart } from '../components/page-test/SalesRankChart'
import { PageTestDataGrid } from '../components/page-test/PageTestDataGrid'
import { usePageReady } from '../hooks/usePageReady'
import { fetchPlusclSnapshot, isPlusclConfigured } from '../services/queryPluscl'
import { buildPageTestDashboard, pageTestFetchRange, type PageTestDashboard } from './pageTest/plusclDashboard'
import './PageTestPage.css'

export function PageTestPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [dashboard, setDashboard] = useState<PageTestDashboard | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  usePageReady('pagetest')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setErrorMessage('')

    if (!isPlusclConfigured()) {
      setDashboard(null)
      setStatus('error')
      setErrorMessage('PlusCL 조회 URL이 설정되지 않았습니다.')
      return
    }

    const { from, to } = pageTestFetchRange()
    void fetchPlusclSnapshot(from, to)
      .then((snapshot) => {
        if (cancelled) return
        const next = buildPageTestDashboard(snapshot)
        setDashboard(next)
        setSelectedCategoryId(next.salesTop5[0]?.id ?? null)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDashboard(null)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'PlusCL 조회 실패')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const capturedLabel = useMemo(() => {
    if (!dashboard?.capturedAt) return null
    const date = new Date(dashboard.capturedAt)
    if (Number.isNaN(date.getTime())) return dashboard.capturedAt
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }, [dashboard?.capturedAt])

  if (status === 'loading') {
    return (
      <section className="page-test page-test--state">
        <p>PlusCL 데이터를 불러오는 중입니다…</p>
      </section>
    )
  }

  if (status === 'error' || !dashboard) {
    return (
      <section className="page-test page-test--state page-test--error">
        <p>{errorMessage || '데이터를 불러오지 못했습니다.'}</p>
      </section>
    )
  }

  return (
    <section className="page-test is-enter">
      {capturedLabel ? <p className="page-test__meta">PlusCL 기준 · {capturedLabel} 수집</p> : null}

      <div className="page-test__kpi">
        <KpiSalesCard data={dashboard.sales} />
        <KpiInventoryCard data={dashboard.inventory6m} />
        <KpiInventoryCard data={dashboard.inventory12m} />
        <KpiAlertCard data={dashboard.alerts} />
      </div>

      <div className="page-test__charts">
        <InventoryTrendChart rows={dashboard.inventoryTrend} />
        <SalesRankChart
          rows={dashboard.salesTop5}
          drilldown={dashboard.salesDrilldown}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      </div>

      <div className="page-test__grid-section">
        <PageTestDataGrid rows={dashboard.gridRows} title="고급 데이터 그리드" />
      </div>
    </section>
  )
}
