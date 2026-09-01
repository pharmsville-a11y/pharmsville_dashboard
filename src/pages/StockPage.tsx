import { useEffect, useMemo, useState } from 'react'
import { KpiAlertCard } from '../components/page-test/KpiAlertCard'
import { KpiInventoryCard } from '../components/page-test/KpiInventoryCard'
import { KpiSalesCard } from '../components/page-test/KpiSalesCard'
import { InventoryTrendChart } from '../components/page-test/InventoryTrendChart'
import { SalesRankChart } from '../components/page-test/SalesRankChart'
import { PlusclStockTable } from '../components/stock/PlusclStockTable'
import { usePageReady } from '../hooks/usePageReady'
import { formatNumber } from '../lib/format'
import { kstYmd } from '../lib/kst'
import {
  fetchPlusclSnapshot,
  isPlusclConfigured,
  type PlusclSnapshot,
  type PlusclStockRow,
} from '../services/queryPluscl'
import { resolveStockBrand, type StockBrand } from '../stock/brands'
import { filterVisibleStock } from '../stock/hiddenStock'
import { buildPageTestDashboard, pageTestFetchRange, type PageTestDashboard } from './pageTest/plusclDashboard'
import './CommercePage.css'
import './PageTestPage.css'

type StockRow = PlusclStockRow & { brand: StockBrand }

export function StockPage() {
  const today = kstYmd()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [pluscl, setPluscl] = useState<PlusclSnapshot | null>(null)
  const [dashboard, setDashboard] = useState<PageTestDashboard | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  usePageReady('stock')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setErrorMessage('')

    if (!isPlusclConfigured()) {
      setPluscl(null)
      setDashboard(null)
      setStatus('error')
      setErrorMessage('조회 URL이 없어 PlusCL을 읽지 못합니다.')
      return
    }

    const { from, to } = pageTestFetchRange()
    void fetchPlusclSnapshot(from, to)
      .then((snapshot) => {
        if (cancelled) return
        setPluscl(snapshot)
        const next = buildPageTestDashboard(snapshot)
        setDashboard(next)
        setSelectedCategoryId(next.salesTop5[0]?.id ?? null)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setPluscl(null)
        setDashboard(null)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : '조회 실패')
      })

    return () => {
      cancelled = true
    }
  }, [today, reloadTick])

  const plusclStock = useMemo<StockRow[]>(
    () =>
      filterVisibleStock(pluscl?.stock ?? []).map((row) => ({ ...row, brand: resolveStockBrand(row) })),
    [pluscl],
  )

  const expire = useMemo(() => {
    const within6m = { lines: 0, qty: 0 }
    const within1y = { lines: 0, qty: 0 }
    const unknown = { lines: 0, qty: 0 }
    let stockQty = 0
    for (const row of plusclStock) {
      stockQty += row.qty
      if (row.remainingDays == null) {
        unknown.lines += 1
        unknown.qty += row.qty
      } else if (row.remainingDays <= 183) {
        within6m.lines += 1
        within6m.qty += row.qty
        within1y.lines += 1
        within1y.qty += row.qty
      } else if (row.remainingDays <= 365) {
        within1y.lines += 1
        within1y.qty += row.qty
      }
    }
    return { within6m, within1y, unknown, stockQty, stockSku: plusclStock.length }
  }, [plusclStock])

  const capturedLabel = useMemo(() => {
    const capturedAt = dashboard?.capturedAt ?? pluscl?.capturedAt
    if (!capturedAt) return null
    const date = new Date(capturedAt)
    if (Number.isNaN(date.getTime())) return capturedAt
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }, [dashboard?.capturedAt, pluscl?.capturedAt])

  if (status === 'loading') {
    return (
      <section className="commerce page-test page-test--state is-enter">
        <p>PlusCL 데이터를 불러오는 중입니다…</p>
      </section>
    )
  }

  if (status === 'error' || !dashboard) {
    return (
      <section className="commerce page-test page-test--state page-test--error is-enter">
        <p>{errorMessage || '데이터를 불러오지 못했습니다.'}</p>
        <button type="button" onClick={() => setReloadTick((tick) => tick + 1)}>
          다시 시도
        </button>
      </section>
    )
  }

  return (
    <section className="commerce page-test is-enter">
      <header className="commerce__head">
        <div>
          <h2>재고</h2>
          <p>PlusCL 현재고와 매출·재고 추이를 함께 봅니다.</p>
        </div>
      </header>

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

      <p className="commerce__banner">
        {pluscl?.stockAsOf
          ? `재고 기준 ${pluscl.stockAsOf.date} ${String(pluscl.stockAsOf.hour).padStart(2, '0')}시 · ${formatNumber(plusclStock.length)} SKU · 현재고 ${formatNumber(expire.stockQty)}개`
          : '조회는 됐지만 현재고 스냅샷이 없습니다.'}
      </p>

      <article className="commerce__panel">
        <PlusclStockTable rows={plusclStock} />
      </article>
    </section>
  )
}
