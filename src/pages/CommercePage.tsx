import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { DateField } from '../components/ui/DateField'
import { usePageReady } from '../hooks/usePageReady'
import { cx } from '../lib/cx'
import { formatNumber, formatSabangnetDateTime, formatWon } from '../lib/format'
import { kstYmd } from '../lib/kst'
import {
  fetchPlusclOrEmpty,
  fetchPlusclSnapshot,
  isPlusclConfigured,
  type PlusclOrderLine,
  type PlusclSnapshot,
} from '../services/queryPluscl'
import { isHiddenPlusclCompany, mergeSabangnetWithPluscl } from '../services/plusclOffline'
import {
  fetchSabangnetSnapshot,
  isSabangnetConfigured,
  type SabangnetProbe,
  type SabangnetSnapshot,
} from '../services/querySabangnet'
import './CommercePage.css'

type SourceId = 'sabangnet' | 'pluscl'
type TabId = 'base' | 'order' | 'out' | 'cancel' | 'exchange' | 'return_complete' | 'noout'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'base', label: '기초정보' },
  { id: 'order', label: '접수' },
  { id: 'out', label: '출고' },
  { id: 'cancel', label: '취소' },
  { id: 'exchange', label: '교환' },
  { id: 'return_complete', label: '회수' },
  { id: 'noout', label: '미출고' },
]

const BASE_KINDS = ['seller', 'warehouse_type', 'order_company', 'delivery', 'deal_company'] as const

const BASE_KIND_LABEL: Record<string, string> = {
  seller: '화주',
  warehouse_type: '창고',
  order_company: '주문사',
  delivery: '택배사',
  deal_company: '거래처',
  common_code: '공통코드',
}

const REPORT_LABEL: Record<string, string> = {
  order: '접수',
  out: '출고',
  cancel: '취소',
  exchange: '교환',
  return_complete: '회수',
  noout: '미출고',
}

const DATE_CONDITIONS = [
  { id: 1, label: '수집일' },
  { id: 2, label: '주문일' },
] as const

const PAGE_SIZE = 15

const TAB_SUMMARY: Record<
  Exclude<TabId, 'base'>,
  'orders' | 'shipped' | 'cancelled' | 'exchanged' | 'returned' | 'unshipped'
> = {
  order: 'orders',
  out: 'shipped',
  cancel: 'cancelled',
  exchange: 'exchanged',
  return_complete: 'returned',
  noout: 'unshipped',
}

function emptySnapshot(from: string, to: string): PlusclSnapshot {
  const zero = { lines: 0, qty: 0, amount: 0 }
  return {
    from,
    to,
    capturedAt: null,
    stockAsOf: null,
    summary: {
      orders: zero,
      shipped: zero,
      cancelled: zero,
      exchanged: zero,
      returned: zero,
      unshipped: zero,
      stockSku: 0,
      stockQty: 0,
      stockExpire: {
        within6m: zero,
        within1y: zero,
        unknown: zero,
      },
      flow: { in_plan: 0, out_plan: 0, in_doc: 0, out_doc: 0 },
    },
    channels: [],
    channelDaily: [],
    base: [],
    orders: [],
    stock: [],
  }
}

function extraText(extra?: Record<string, unknown>): string {
  if (!extra) return ''
  return Object.entries(extra)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ')
}

export function CommercePage() {
  const today = kstYmd()
  const monthAgo = kstYmd(new Date(), -29)
  const [source, setSource] = useState<SourceId>('sabangnet')
  const [from, setFrom] = useState(monthAgo)
  const [to, setTo] = useState(today)
  const [query, setQuery] = useState('')
  const [applied, setApplied] = useState({ from: monthAgo, to: today, query: '', tick: 0 })
  const [condition, setCondition] = useState(2)
  const [probe, setProbe] = useState(false)
  const [tab, setTab] = useState<TabId>('base')
  const [baseKind, setBaseKind] = useState<string>('all')
  const [shopFilter, setShopFilter] = useState('all')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [data, setData] = useState<PlusclSnapshot | null>(null)
  const [sabangnet, setSabangnet] = useState<SabangnetSnapshot | null>(null)

  usePageReady('commerce')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setErrorMessage('')
    if (source === 'sabangnet') {
      if (!isSabangnetConfigured()) {
        setSabangnet(null)
        setStatus('error')
        setErrorMessage('조회 URL이 없어 사방넷을 읽지 못합니다. 로컬은 VITE_QUERY_URL을 확인하세요.')
        return
      }
      void Promise.all([
        fetchSabangnetSnapshot(applied.from, applied.to, condition, probe),
        fetchPlusclOrEmpty(applied.from, applied.to),
      ])
        .then(([snapshot, plusclSnapshot]) => {
          if (cancelled) return
          setSabangnet(snapshot)
          setData(plusclSnapshot)
          setStatus(snapshot.error ? 'error' : 'ready')
          setErrorMessage(snapshot.error ?? '')
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setSabangnet(null)
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : '조회 실패')
        })
      return () => {
        cancelled = true
      }
    }

    if (!isPlusclConfigured()) {
      setData(null)
      setStatus('error')
      setErrorMessage('조회 URL이 없어 PlusCL을 읽지 못합니다. 로컬은 VITE_QUERY_URL을 확인하세요.')
      return
    }
    void fetchPlusclSnapshot(applied.from, applied.to)
      .then((snapshot) => {
        if (cancelled) return
        setData(snapshot)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setData(null)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : '조회 실패')
      })
    return () => {
      cancelled = true
    }
  }, [source, applied.from, applied.to, applied.tick, condition, probe])

  useEffect(() => {
    setShopFilter('all')
  }, [applied.from, applied.to, applied.tick, source])

  const snapshot = data ?? emptySnapshot(applied.from, applied.to)
  const needle = applied.query.trim().toLowerCase()

  const counts = useMemo(() => {
    const byKind: Record<string, number> = {}
    for (const row of snapshot.base) {
      byKind[row.kind] = (byKind[row.kind] ?? 0) + 1
    }
    return { byKind }
  }, [snapshot.base])

  const tabCount = (id: TabId): number => {
    if (id === 'base') return snapshot.base.length
    const key = TAB_SUMMARY[id]
    return snapshot.summary[key].lines
  }

  const visibleBase = useMemo(() => {
    return snapshot.base.filter((row) => {
      if (baseKind !== 'all' && row.kind !== baseKind) return false
      if (!needle) return true
      return `${row.kind} ${row.code} ${row.name} ${extraText(row.extra)}`.toLowerCase().includes(needle)
    })
  }, [snapshot.base, baseKind, needle])

  const visibleOrders = useMemo(() => {
    return snapshot.orders.filter((row) => {
      if (isHiddenPlusclCompany(row.ordCompName, row.ordCompCode)) return false
      if (row.reportType !== tab) return false
      if (!needle) return true
      return `${row.ordDate} ${row.ordCompName} ${row.ordCompCode} ${row.ordNo1} ${row.itemName} ${row.itemCode} ${row.invoiceNo}`
        .toLowerCase()
        .includes(needle)
    })
  }, [snapshot.orders, tab, needle])

  const visibleSabangnet = useMemo(() => {
    const merged = mergeSabangnetWithPluscl(sabangnet, source === 'sabangnet' ? data : null)
    return merged.rows.filter((row) => {
      const shop = pick(row, ['SHOP_NM'])
      if (shopFilter !== 'all' && shop !== shopFilter) return false
      if (!needle) return true
      return JSON.stringify(row).toLowerCase().includes(needle)
    })
  }, [sabangnet, data, needle, shopFilter, source])

  const mergedSales = useMemo(
    () => mergeSabangnetWithPluscl(sabangnet, source === 'sabangnet' ? data : null),
    [sabangnet, data, source],
  )

  const hasAny =
    snapshot.base.length > 0 || snapshot.orders.length > 0 || snapshot.stock.length > 0

  return (
    <section className="commerce is-enter">
      <header className="commerce__head">
        <div>
          <h2>매출·주문</h2>
          <p>
            {source === 'sabangnet'
              ? '사방넷 확정 주문에 PlusCL 오프라인 주문(사방넷_APPLE6·CJ직배·자사주문 제외)을 합칩니다.'
              : 'PlusCL 물류 주문·재고 화면입니다. 쇼핑몰 매출 원장은 사방넷 탭에서 봅니다.'}
          </p>
          <div className="commerce__source">
            <button
              type="button"
              className={source === 'sabangnet' ? 'is-on' : undefined}
              onClick={() => setSource('sabangnet')}
            >
              사방넷
            </button>
            <button
              type="button"
              className={source === 'pluscl' ? 'is-on' : undefined}
              onClick={() => setSource('pluscl')}
            >
              PlusCL
            </button>
          </div>
        </div>
        <form
          className="commerce__range"
          onSubmit={(event) => {
            event.preventDefault()
            const start = from <= to ? from : to
            const end = from <= to ? to : from
            setApplied({ from: start, to: end, query: query.trim(), tick: applied.tick + 1 })
          }}
        >
          <DateField
            label="기간"
            from={from}
            to={to}
            max={today}
            onChange={(next) => {
              setFrom(next.from)
              setTo(next.to)
            }}
          />
          <label className="commerce__search">
            검색
            <input
              type="search"
              value={query}
              placeholder={source === 'sabangnet' ? '주문번호, 쇼핑몰, 상품, 필드값' : '주문번호, 상품, 주문사, 코드'}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button type="submit">조회</button>
        </form>
      </header>

      {source === 'sabangnet' ? (
        <SabangnetBody
          status={status}
          errorMessage={errorMessage}
          snapshot={sabangnet}
          merged={mergedSales}
          visibleRows={visibleSabangnet}
          shopFilter={shopFilter}
          onShopFilter={setShopFilter}
          condition={condition}
          onCondition={setCondition}
          probe={probe}
          onProbe={() => setProbe(true)}
        />
      ) : (
        <>
          <p className="commerce__banner">
            {status === 'loading'
              ? 'PlusCL 조회 중…'
              : status === 'error'
                ? errorMessage
                : hasAny
                  ? `API 수신 확인 · 기초정보 ${formatNumber(snapshot.base.length)} · 주문 ${formatNumber(snapshot.orders.length)}`
                  : '조회는 됐지만 재고·주문이 아직 비어 있습니다. 기초정보가 있으면 연결은 된 상태입니다.'}
          </p>

          <div className="commerce__cards">
            <SummaryCard
              label="접수"
              value={`${formatNumber(snapshot.summary.orders.lines)}건`}
              sub={qtyText(snapshot.summary.orders.qty, snapshot.summary.orders.amount)}
              active={tab === 'order'}
              onClick={() => setTab('order')}
            />
            <SummaryCard
              label="출고"
              value={`${formatNumber(snapshot.summary.shipped.lines)}건`}
              sub={qtyText(snapshot.summary.shipped.qty, snapshot.summary.shipped.amount)}
              active={tab === 'out'}
              onClick={() => setTab('out')}
            />
            <SummaryCard
              label="취소·미출고"
              value={`${formatNumber(snapshot.summary.cancelled.lines + snapshot.summary.unshipped.lines)}건`}
              sub={`취소 ${formatNumber(snapshot.summary.cancelled.lines)} · 미출고 ${formatNumber(snapshot.summary.unshipped.lines)}`}
              active={tab === 'cancel' || tab === 'noout'}
              onClick={() => setTab('cancel')}
            />
          </div>

          <div className="commerce__meta">
            <span>입고예정 {formatNumber(snapshot.summary.flow.in_plan)} · 출고예정 {formatNumber(snapshot.summary.flow.out_plan)}</span>
            <span>입고서 {formatNumber(snapshot.summary.flow.in_doc)} · 출고서 {formatNumber(snapshot.summary.flow.out_doc)}</span>
            {snapshot.stockAsOf ? (
              <span>
                재고 기준 {snapshot.stockAsOf.date} {String(snapshot.stockAsOf.hour).padStart(2, '0')}시
              </span>
            ) : (
              <span>재고 스냅샷 없음</span>
            )}
          </div>

          {snapshot.channels.filter((row) => !isHiddenPlusclCompany(row.name)).length > 0 ? (
            <div className="commerce__channels">
              {snapshot.channels
                .filter((row) => !isHiddenPlusclCompany(row.name))
                .slice(0, 12)
                .map((row) => (
                <button
                  key={row.name}
                  type="button"
                  onClick={() => {
                    setQuery(row.name)
                    setApplied((current) => ({ ...current, query: row.name, tick: current.tick + 1 }))
                    if (tab === 'base') setTab('order')
                  }}
                >
                  <strong>{row.name}</strong>
                  <span>{formatNumber(row.lines)}건</span>
                </button>
              ))}
            </div>
          ) : null}

          <article className="commerce__panel">
            <div className="commerce__tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={tab === item.id ? 'is-on' : undefined}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                  <em>{formatNumber(tabCount(item.id))}</em>
                </button>
              ))}
            </div>

            {tab === 'base' ? (
              <div className="commerce__filters">
                <button type="button" className={baseKind === 'all' ? 'is-on' : undefined} onClick={() => setBaseKind('all')}>
                  전체 {formatNumber(snapshot.base.length)}
                </button>
                {BASE_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={baseKind === kind ? 'is-on' : undefined}
                    onClick={() => setBaseKind(kind)}
                  >
                    {BASE_KIND_LABEL[kind]} {formatNumber(counts.byKind[kind] ?? 0)}
                  </button>
                ))}
              </div>
            ) : null}

            {status === 'loading' ? (
              <p className="commerce__empty">불러오는 중…</p>
            ) : tab === 'base' ? (
              <BaseTable key={`${baseKind}-${needle}`} rows={visibleBase} total={snapshot.base.length} />
            ) : (
              <OrderTable key={`${tab}-${needle}`} rows={visibleOrders} total={tabCount(tab)} />
            )}
          </article>
        </>
      )}
    </section>
  )
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function rowAmount(row: Record<string, unknown>): number {
  const raw = pick(row, ['PAY_TOT_AMT', 'ORDER_TOT_AMT', 'CT_SALE_COST'])
  const parsed = Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function restFields(row: Record<string, unknown>, skip: string[]): string {
  const skipSet = new Set(skip)
  return Object.entries(row)
    .filter(([key, value]) => !skipSet.has(key) && value != null && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ')
}

function SabangnetBody({
  status,
  errorMessage,
  snapshot,
  merged,
  visibleRows,
  shopFilter,
  onShopFilter,
  condition,
  onCondition,
  probe,
  onProbe,
}: {
  status: 'loading' | 'ready' | 'error'
  errorMessage: string
  snapshot: SabangnetSnapshot | null
  merged: ReturnType<typeof mergeSabangnetWithPluscl>
  visibleRows: Record<string, unknown>[]
  shopFilter: string
  onShopFilter: (value: string) => void
  condition: number
  onCondition: (value: number) => void
  probe: boolean
  onProbe: () => void
}) {
  const [shopsOpen, setShopsOpen] = useState(false)
  const notes = snapshot?.notes ?? []
  const shops = merged.shops
  const orderRows = merged.orderRows
  const amount = merged.amount
  const fieldKeys = snapshot?.fieldKeys ?? []
  const statusEntries = Object.entries(snapshot?.statusCounts ?? {})
  const samples = (snapshot?.rows ?? []).slice(0, 2)
  const skip = [
    'ORDER_DT',
    'COLLECT_DT',
    'ORDER_STATUS',
    'SHOP_NM',
    'SB_ORD_NO',
    'SHOP_ORD_NO',
    'GOODS_NM',
    'PRODUCT_NM',
    'ITEM_NM',
    'SKU_VALUE',
    'ORD_CNT',
    'CM_EA',
    'PAY_TOT_AMT',
    'ORDER_TOT_AMT',
    'CT_SALE_COST',
  ]

  return (
    <>
      <p className="commerce__banner">
        {status === 'loading'
          ? '사방넷 주문 API 조회 중…'
          : status === 'error'
            ? errorMessage || '사방넷 조회 실패'
            : orderRows
              ? `사방넷 ${formatNumber(snapshot?.orderRows ?? 0)}줄 + 오프라인 ${formatNumber(merged.plusclRows)}줄 · 화면 ${formatNumber(visibleRows.length)}줄`
              : '연결은 됐지만 이 기간·조건의 확정 주문이 0건입니다. 날짜조건이나 기간을 바꿔 보세요.'}
      </p>
      {notes.length > 0 ? (
        <p className="commerce__banner">{notes.join(' · ')}</p>
      ) : null}

      <div className="commerce__cards">
        <div className="commerce__card is-brand">
          <p>주문줄</p>
          <strong>{formatNumber(orderRows)}건</strong>
          <span>화면 {formatNumber(visibleRows.length)}건</span>
        </div>
        <div className="commerce__card">
          <p>금액 합</p>
          <strong>{formatWon(amount)}</strong>
          <span>사방넷 + 오프라인</span>
        </div>
        <div className="commerce__card">
          <p>쇼핑몰</p>
          <strong>{formatNumber(shops.length)}곳</strong>
          <span>{shops[0]?.name ?? '아직 없음'}</span>
        </div>
        <div className="commerce__card">
          <p>응답 필드</p>
          <strong>{formatNumber(fieldKeys.length)}개</strong>
          <span>개인정보는 제외</span>
        </div>
      </div>

      <div className="commerce__filters">
        {DATE_CONDITIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={condition === item.id ? 'is-on' : undefined}
            onClick={() => onCondition(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className={probe ? 'is-on' : undefined} onClick={onProbe}>
          다른 API도 탐색
        </button>
      </div>

      {statusEntries.length > 0 ? (
        <div className="commerce__meta" style={{ display: 'none' }}>
          {statusEntries.map(([key, count]) => (
            <span key={key}>
              {key} {formatNumber(count)}
            </span>
          ))}
        </div>
      ) : null}

      {shops.length > 0 ? (
        <div className="commerce__channels-block">
          <div className={cx('commerce__channels-clip', shopsOpen && 'is-open')}>
            <div className="commerce__channels">
              <button type="button" className={shopFilter === 'all' ? 'is-on' : undefined} onClick={() => onShopFilter('all')}>
                전체
                <span>{formatNumber(orderRows)}건</span>
              </button>
              {shops.map((row) => (
                <button
                  key={`${row.name}-${row.loginId}`}
                  type="button"
                  className={shopFilter === row.name ? 'is-on' : undefined}
                  onClick={() => onShopFilter(row.name)}
                >
                  <strong>{row.name}</strong>
                  <span>
                    {formatNumber(row.count)}건
                    {row.amount ? ` · ${formatWon(row.amount)}` : ''}
                    {row.loginId === 'pluscl' ? ' · 오프라인' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="commerce__channels-toggle"
            onClick={() => setShopsOpen((current) => !current)}
          >
            {shopsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {shopsOpen ? '리스트 닫기' : '리스트 열기'}
          </button>
        </div>
      ) : null}

      {fieldKeys.length > 0 ? (
        <div className="commerce__keys" style={{ display: 'none' }}>
          {fieldKeys.map((key) => (
            <code key={key}>{key}</code>
          ))}
        </div>
      ) : null}

      {snapshot?.probes?.length ? <ProbeTable probes={snapshot.probes} /> : null}

      <article className="commerce__panel">
        {status === 'loading' ? (
          <p className="commerce__empty">불러오는 중…</p>
        ) : (
          <SabangnetTable
            key={`${shopFilter}-${visibleRows.length}`}
            rows={visibleRows}
            total={orderRows}
            skip={skip}
          />
        )}
      </article>

      {samples.length > 0 ? (
        <pre className="commerce__json" style={{ display: 'none' }}>{JSON.stringify(samples, null, 2)}</pre>
      ) : null}
    </>
  )
}

type SabangnetSortKey = 'date' | 'time' | 'status' | 'shop' | 'sbOrd' | 'shopOrd' | 'goods' | 'qty' | 'amount'

function sabangnetSortValue(row: Record<string, unknown>, key: SabangnetSortKey): string | number {
  if (key === 'date' || key === 'time') {
    const parsed = formatSabangnetDateTime(pick(row, ['ORDER_DT', 'COLLECT_DT']))
    return key === 'date' ? parsed.date : parsed.time
  }
  if (key === 'status') return pick(row, ['ORDER_STATUS'])
  if (key === 'shop') return pick(row, ['SHOP_NM'])
  if (key === 'sbOrd') return pick(row, ['SB_ORD_NO'])
  if (key === 'shopOrd') return pick(row, ['SHOP_ORD_NO'])
  if (key === 'goods') return pick(row, ['GOODS_NM', 'PRODUCT_NM', 'ITEM_NM', 'SKU_VALUE'])
  if (key === 'qty') return Number(pick(row, ['ORD_CNT', 'CM_EA']).replace(/,/g, '')) || 0
  return rowAmount(row)
}

function SortTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  column: SabangnetSortKey
  sortKey: SabangnetSortKey
  sortDir: 'asc' | 'desc'
  onSort: (column: SabangnetSortKey) => void
}) {
  const active = sortKey === column
  return (
    <th>
      <button type="button" className={`commerce__sort${active ? ' is-on' : ''}`} onClick={() => onSort(column)}>
        {label}
        <em>{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</em>
      </button>
    </th>
  )
}

function SabangnetTable({
  rows,
  total,
  skip,
}: {
  rows: Record<string, unknown>[]
  total: number
  skip: string[]
}) {
  const [sortKey, setSortKey] = useState<SabangnetSortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  function handleSort(column: SabangnetSortKey) {
    if (sortKey === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column)
    setSortDir(column === 'date' || column === 'time' || column === 'amount' || column === 'qty' ? 'desc' : 'asc')
  }

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((left, right) => {
      const a = sabangnetSortValue(left, sortKey)
      const b = sabangnetSortValue(right, sortKey)
      const compared =
        typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), 'ko')
      if (compared !== 0) return sortDir === 'asc' ? compared : -compared
      const dateCmp = String(sabangnetSortValue(left, 'date')).localeCompare(String(sabangnetSortValue(right, 'date')))
      if (dateCmp !== 0) return -dateCmp
      return String(sabangnetSortValue(left, 'time')).localeCompare(String(sabangnetSortValue(right, 'time'))) * -1
    })
    return copy
  }, [rows, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [rows, sortKey, sortDir])

  const paged = pageSlice(sorted, page)

  if (total === 0) {
    return (
      <p className="commerce__empty">
        이 기간에 확정 주문이 없습니다. 사방넷은 신규(미확정) 주문을 주지 않습니다.
      </p>
    )
  }
  if (rows.length === 0) return <p className="commerce__empty">검색어·쇼핑몰 조건에 맞는 주문이 없습니다.</p>
  return (
    <>
    <table>
      <thead>
        <tr>
          <SortTh label="일자" column="date" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="시간" column="time" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="상태" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="쇼핑몰" column="shop" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="사방넷주문" column="sbOrd" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="쇼핑몰주문" column="shopOrd" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="상품" column="goods" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="수량" column="qty" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <SortTh label="금액" column="amount" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
          <th>그 외 필드</th>
        </tr>
      </thead>
      <tbody>
        {paged.pageRows.map((row, index) => {
          const goods = pick(row, ['GOODS_NM', 'PRODUCT_NM', 'ITEM_NM', 'SKU_VALUE'])
          const qty = pick(row, ['ORD_CNT', 'CM_EA'])
          const amount = rowAmount(row)
          const when = formatSabangnetDateTime(pick(row, ['ORDER_DT', 'COLLECT_DT']))
          return (
            <tr key={`${pick(row, ['SB_ORD_NO', 'SHOP_ORD_NO']) || index}-${(paged.page - 1) * PAGE_SIZE + index}`}>
              <td className="commerce__date">{when.date || '—'}</td>
              <td className="commerce__time">{when.time || '—'}</td>
              <td>{pick(row, ['ORDER_STATUS']) || '—'}</td>
              <td>{pick(row, ['SHOP_NM']) || '—'}</td>
              <td>{pick(row, ['SB_ORD_NO']) || '—'}</td>
              <td>{pick(row, ['SHOP_ORD_NO']) || '—'}</td>
              <td>
                <strong>{goods || '—'}</strong>
              </td>
              <td>{qty || '—'}</td>
              <td>{amount ? formatWon(amount) : '—'}</td>
              <td className="commerce__extra">{restFields(row, skip) || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
      <ListPager page={paged.page} total={sorted.length} onPage={setPage} />
    </>
  )
}

function ProbeTable({ probes }: { probes: SabangnetProbe[] }) {
  return (
    <article className="commerce__panel">
      <p className="commerce__empty" style={{ marginTop: 0 }}>
        날짜조건 1~5와 쇼핑몰 관련 경로를 실제로 두들긴 결과입니다.
      </p>
      <table>
        <thead>
          <tr>
            <th>대상</th>
            <th>결과</th>
            <th>건수</th>
            <th>필드</th>
            <th>메시지</th>
          </tr>
        </thead>
        <tbody>
          {probes.map((item, index) => (
            <tr key={`${item.kind}-${item.condition ?? item.path}-${item.method ?? ''}-${index}`}>
              <td>
                {item.kind === 'order'
                  ? `주문 조건 ${item.condition}`
                  : `${item.method ?? ''} ${item.path ?? ''}`.trim()}
              </td>
              <td>{item.error || item.http || 'ok'}</td>
              <td>{item.count == null ? '—' : formatNumber(item.count)}</td>
              <td className="commerce__extra">{(item.row_keys ?? item.keys ?? []).join(', ') || '—'}</td>
              <td className="commerce__extra">{item.message != null ? String(item.message) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

function qtyText(qty: number, amount: number): string {
  return amount > 0 ? `${formatNumber(qty)}개 · ${formatWon(amount)}` : `${formatNumber(qty)}개`
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
  active,
  onClick,
}: {
  label: string
  value: string
  sub: string
  tone?: 'brand'
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`commerce__card${tone === 'brand' ? ' is-brand' : ''}${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{sub}</span>
    </button>
  )
}

function pageSlice<T>(rows: T[], page: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pages)
  return {
    pageRows: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    page: current,
    pages,
  }
}

function ListPager({
  page,
  total,
  onPage,
}: {
  page: number
  total: number
  onPage: (page: number) => void
}) {
  if (total <= PAGE_SIZE) return null
  const pages = Math.ceil(total / PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="commerce__pager">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        이전
      </button>
      <span>
        {formatNumber(start)}–{formatNumber(end)} / {formatNumber(total)}건
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        다음
      </button>
    </div>
  )
}

function OrderTable({ rows, total }: { rows: PlusclOrderLine[]; total: number }) {
  const [page, setPage] = useState(1)
  const paged = pageSlice(rows, page)
  useEffect(() => {
    setPage(1)
  }, [rows])

  if (total === 0) return <p className="commerce__empty">이 구간에 해당하는 주문이 없습니다. 수집이 되면 여기에 행이 생깁니다.</p>
  if (rows.length === 0) return <p className="commerce__empty">검색어에 맞는 주문이 없습니다.</p>
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>일자</th>
            <th>상태</th>
            <th>주문사</th>
            <th>주문번호</th>
            <th>상품</th>
            <th>수량</th>
            <th>금액</th>
            <th>송장</th>
          </tr>
        </thead>
        <tbody>
          {paged.pageRows.map((row) => (
            <tr key={`${row.reportType}-${row.ordInnerSeq}-${row.itemSeq}`}>
              <td>{row.ordDate}</td>
              <td>{REPORT_LABEL[row.reportType] ?? row.reportType}</td>
              <td>{row.ordCompName || row.ordCompCode || '—'}</td>
              <td>{row.ordNo1 || '—'}</td>
              <td>
                <strong>{row.itemName || row.itemCode || '—'}</strong>
                {row.optionName ? <span>{row.optionName}</span> : null}
              </td>
              <td>{formatNumber(row.qty)}</td>
              <td>{row.amount ? formatWon(row.amount) : '—'}</td>
              <td>{row.invoiceNo || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ListPager page={paged.page} total={rows.length} onPage={setPage} />
    </>
  )
}

function BaseTable({ rows, total }: { rows: PlusclSnapshot['base']; total: number }) {
  const [page, setPage] = useState(1)
  const paged = pageSlice(rows, page)
  useEffect(() => {
    setPage(1)
  }, [rows])

  if (total === 0) {
    return <p className="commerce__empty">기초정보가 없습니다. 수집기가 /open/base_data 를 아직 못 받은 상태입니다.</p>
  }
  if (rows.length === 0) return <p className="commerce__empty">이 구분·검색에 맞는 기초정보가 없습니다.</p>
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>구분</th>
            <th>코드</th>
            <th>이름</th>
            <th>부가</th>
          </tr>
        </thead>
        <tbody>
          {paged.pageRows.map((row) => (
            <tr key={`${row.kind}-${row.code}`}>
              <td>{BASE_KIND_LABEL[row.kind] ?? row.kind}</td>
              <td>{row.code || '—'}</td>
              <td>{row.name || '—'}</td>
              <td className="commerce__extra">{extraText(row.extra) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ListPager page={paged.page} total={rows.length} onPage={setPage} />
    </>
  )
}

