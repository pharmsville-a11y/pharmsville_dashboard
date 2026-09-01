import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Play, X, Package, Warehouse } from 'lucide-react'
import { DateField } from '../ui/DateField'
import { formatNumber, formatWon } from '../../lib/format'
import { kstYmd } from '../../lib/kst'
import {
  fetchPlusclSnapshot,
  isPlusclConfigured,
  plusclCollectUrl,
  plusclQueryUrl,
  triggerPlusclCollect,
  type PlusclCollectResult,
  type PlusclOrderLine,
  type PlusclSnapshot,
  type PlusclStockRow,
} from '../../services/queryPluscl'
import './SabangnetCollectProbe.css'

type TabId = 'orders' | 'stock' | 'channels' | 'base'

const REPORT_LABEL: Record<string, string> = {
  order: '접수',
  out: '출고',
  cancel: '취소',
  exchange: '교환',
  return_complete: '회수',
  noout: '미출고',
}

const ORDER_FIELDS: Array<{ key: keyof PlusclOrderLine; label: string }> = [
  { key: 'reportType', label: '유형' },
  { key: 'ordDate', label: '주문일' },
  { key: 'eventAt', label: '이벤트시각' },
  { key: 'ordCompName', label: '주문사' },
  { key: 'ordCompCode', label: '주문사코드' },
  { key: 'ordNo1', label: '주문번호' },
  { key: 'ordInnerSeq', label: '내부순번' },
  { key: 'itemSeq', label: '품목순번' },
  { key: 'itemCode', label: '품목코드' },
  { key: 'itemName', label: '품목명' },
  { key: 'optionName', label: '옵션명' },
  { key: 'qty', label: '수량' },
  { key: 'amount', label: '금액' },
  { key: 'farePrice', label: '배송비' },
  { key: 'invoiceNo', label: '송장번호' },
]

const STOCK_FIELDS: Array<{ key: keyof PlusclStockRow; label: string }> = [
  { key: 'itemCode', label: '품목코드' },
  { key: 'itemName', label: '품목명' },
  { key: 'optionName', label: '옵션명' },
  { key: 'category1', label: '대분류' },
  { key: 'category2', label: '중분류' },
  { key: 'warehouse', label: '창고' },
  { key: 'lotNo', label: '로트' },
  { key: 'manufacturedOn', label: '제조일' },
  { key: 'expireDate', label: '유통기한' },
  { key: 'remainingDays', label: '잔여일' },
  { key: 'shelfLife', label: '유통기간' },
  { key: 'shelfLifeUnit', label: '유통기간단위' },
  { key: 'qty', label: '재고수량' },
  { key: 'locations', label: '로케이션수' },
]

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function formatCell(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value) : '—'
  return text(value) || '—'
}

function formatCaptured(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function ProbeTh({ label, keyName }: { label: string; keyName: string }) {
  return (
    <th>
      <span className="sb-probe__th-label">{label}</span>
      <span className="sb-probe__th-key">({keyName})</span>
    </th>
  )
}

function DetailModal({
  title,
  rows,
  onClose,
}: {
  title: string
  rows: Array<{ label: string; key: string; value: string }>
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('is-sb-probe-modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-sb-probe-modal-open')
    }
  }, [onClose])

  const filled = rows.filter((row) => row.value !== '—').length

  return createPortal(
    <div className="sb-probe-modal" role="presentation" onClick={onClose}>
      <div
        className="sb-probe-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pluscl-probe-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sb-probe-modal__head">
          <div>
            <h3 id="pluscl-probe-detail-title">PlusCL 상세</h3>
            <p className="sb-probe-modal__sub">
              {title} · 값 있음 {filled}/{rows.length}
            </p>
          </div>
          <button type="button" className="sb-probe-modal__close" aria-label="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="sb-probe-modal__sheet-wrap">
          <table className="sb-probe-modal__sheet">
            <colgroup>
              <col className="sb-probe-modal__col-label" />
              <col className="sb-probe-modal__col-key" />
              <col className="sb-probe-modal__col-value" />
            </colgroup>
            <thead>
              <tr>
                <th>항목</th>
                <th>키</th>
                <th>값</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.value === '—' ? 'is-empty' : undefined}>
                  <td className="sb-probe-modal__label">
                    <span className="sb-probe-modal__label-main">{row.label}</span>
                  </td>
                  <td className="sb-probe-modal__key">{row.key}</td>
                  <td className="sb-probe-modal__value">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function PlusclCollectProbe() {
  const today = kstYmd()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [tab, setTab] = useState<TabId>('orders')
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PlusclSnapshot | null>(null)
  const [collectResult, setCollectResult] = useState<PlusclCollectResult | null>(null)
  const [detail, setDetail] = useState<{
    title: string
    rows: Array<{ label: string; key: string; value: string }>
  } | null>(null)

  const configured = isPlusclConfigured()
  const collectConfigured = Boolean(plusclCollectUrl())

  const load = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    setError(null)
    try {
      const snapshot = await fetchPlusclSnapshot(from, to)
      setData(snapshot)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : '조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [configured, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const runCollect = async () => {
    if (!collectConfigured) return
    setCollecting(true)
    setError(null)
    try {
      const result = await triggerPlusclCollect('full')
      setCollectResult(result)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '수집에 실패했습니다.')
    } finally {
      setCollecting(false)
    }
  }

  const reportCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of data?.orders ?? []) {
      map.set(row.reportType, (map.get(row.reportType) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  const openOrderDetail = (row: PlusclOrderLine) => {
    setDetail({
      title: `${row.ordCompName || '주문'} · ${row.ordNo1 || row.itemCode || '상세'}`,
      rows: ORDER_FIELDS.map((field) => ({
        label: field.label,
        key: field.key,
        value:
          field.key === 'reportType'
            ? REPORT_LABEL[row.reportType] || row.reportType || '—'
            : field.key === 'amount' || field.key === 'farePrice'
              ? formatWon(Number(row[field.key]) || 0)
              : formatCell(row[field.key]),
      })),
    })
  }

  const openStockDetail = (row: PlusclStockRow) => {
    setDetail({
      title: `${row.itemName || row.itemCode || '재고'} · ${row.warehouse || '창고'}`,
      rows: STOCK_FIELDS.map((field) => ({
        label: field.label,
        key: field.key,
        value: formatCell(row[field.key]),
      })),
    })
  }

  return (
    <section className="sb-probe" aria-label="PlusCL 수집 데이터 확인">
      <header className="sb-probe__head">
        <div>
          <h3 className="sb-probe__title">PlusCL API 수집 확인</h3>
          <p className="sb-probe__desc">
            PlusCL 조회 API(<code>query-pluscl</code>)로 주문·재고·채널 집계를 확인합니다.
          </p>
        </div>
        <div className="sb-probe__actions">
          <DateField
            label="조회 기간"
            from={from}
            to={to}
            max={today}
            onChange={(next) => {
              setFrom(next.from)
              setTo(next.to)
            }}
          />
          <button type="button" className="sb-probe__btn" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden />
            새로고침
          </button>
          {collectConfigured ? (
            <button
              type="button"
              className="sb-probe__btn sb-probe__btn--primary"
              disabled={collecting || loading}
              onClick={() => void runCollect()}
            >
              <Play size={15} aria-hidden />
              {collecting ? '수집 중…' : '수집 실행'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="sb-probe__status">
        <span className={configured ? 'sb-probe__ok' : 'sb-probe__warn'}>
          API {configured ? plusclQueryUrl() : '미설정'}
        </span>
        <span className={collectConfigured ? 'sb-probe__ok' : 'sb-probe__warn'}>
          수집 {collectConfigured ? plusclCollectUrl() : '미설정'}
        </span>
      </div>

      {error ? (
        <p className="sb-probe__error" role="alert">
          {error}
        </p>
      ) : null}

      {collectResult ? (
        <div className="sb-probe__collect-result">
          <strong>수집 완료</strong>
          <span>{collectResult.notes.slice(0, 3).join(' · ') || 'notes 없음'}</span>
        </div>
      ) : null}

      <div className="sb-probe__kpis">
        <article className="sb-probe__kpi">
          <span className="sb-probe__kpi-label">주문줄 (기간)</span>
          <strong>{formatNumber(data?.orders.length ?? 0)}</strong>
          <small>{formatWon(data?.summary.orders.amount ?? 0)}</small>
        </article>
        <article className="sb-probe__kpi">
          <span className="sb-probe__kpi-label">재고 SKU / 수량</span>
          <strong>{formatNumber(data?.summary.stockSku ?? 0)}</strong>
          <small>{formatNumber(data?.summary.stockQty ?? 0)}개</small>
        </article>
        <article className="sb-probe__kpi">
          <span className="sb-probe__kpi-label">captured_at</span>
          <strong className="sb-probe__kpi-mono">{formatCaptured(data?.capturedAt ?? null)}</strong>
          <small>
            {data?.stockAsOf
              ? `재고기준 ${data.stockAsOf.date} ${data.stockAsOf.hour}시`
              : '재고 기준시각 없음'}
          </small>
        </article>
      </div>

      <div className="sb-probe__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          className={tab === 'orders' ? 'is-active' : ''}
          onClick={() => setTab('orders')}
        >
          <Package size={15} aria-hidden />
          주문
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stock'}
          className={tab === 'stock' ? 'is-active' : ''}
          onClick={() => setTab('stock')}
        >
          <Warehouse size={15} aria-hidden />
          재고
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'channels'}
          className={tab === 'channels' ? 'is-active' : ''}
          onClick={() => setTab('channels')}
        >
          채널
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'base'}
          className={tab === 'base' ? 'is-active' : ''}
          onClick={() => setTab('base')}
        >
          기초정보
        </button>
      </div>

      <div className="sb-probe__panel">
        {!configured ? (
          <p className="sb-probe__muted">VITE_QUERY_URL 또는 VITE_PLUSCL_URL 을 설정하세요.</p>
        ) : !data ? (
          <p className="sb-probe__muted">{loading ? '조회 중…' : '데이터가 없습니다.'}</p>
        ) : tab === 'orders' ? (
          <>
            <h4 className="sb-probe__section-title">주문 유형</h4>
            <div className="sb-probe__chips">
              {reportCounts.length === 0 ? (
                <span className="sb-probe__muted">유형 집계 없음</span>
              ) : (
                reportCounts.map(([type, count]) => (
                  <span key={type} className="sb-probe__chip">
                    {REPORT_LABEL[type] || type} <strong>{formatNumber(count)}</strong>
                  </span>
                ))
              )}
            </div>

            <h4 className="sb-probe__section-title">
              주문 원본 ({from}~{to}, {formatNumber(data.orders.length)}건)
            </h4>
            <div className="sb-probe__table-wrap sb-probe__table-wrap--scroll">
              <table className="sb-probe__table sb-probe__table--compact">
                <thead>
                  <tr>
                    <ProbeTh label="유형" keyName="reportType" />
                    <ProbeTh label="주문일" keyName="ordDate" />
                    <ProbeTh label="이벤트시각" keyName="eventAt" />
                    <ProbeTh label="주문사" keyName="ordCompName" />
                    <ProbeTh label="주문번호" keyName="ordNo1" />
                    <ProbeTh label="품목" keyName="itemName" />
                    <ProbeTh label="수량" keyName="qty" />
                    <ProbeTh label="금액" keyName="amount" />
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="sb-probe__muted">
                        기간 내 주문 없음
                      </td>
                    </tr>
                  ) : (
                    data.orders.slice(0, 200).map((row, index) => (
                      <tr key={`${row.ordInnerSeq}-${row.itemSeq}-${index}`}>
                        <td>{REPORT_LABEL[row.reportType] || row.reportType || '—'}</td>
                        <td className="sb-probe__mono">{row.ordDate || '—'}</td>
                        <td className="sb-probe__mono">{row.eventAt || '—'}</td>
                        <td>{row.ordCompName || '—'}</td>
                        <td className="sb-probe__mono">{row.ordNo1 || '—'}</td>
                        <td className="sb-probe__truncate">{row.itemName || row.itemCode || '—'}</td>
                        <td>{formatNumber(row.qty)}</td>
                        <td>{formatWon(row.amount)}</td>
                        <td>
                          <button type="button" className="sb-probe__link-btn" onClick={() => openOrderDetail(row)}>
                            상세보기
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data.orders.length > 200 ? <p className="sb-probe__muted">상위 200건만 표시합니다.</p> : null}
          </>
        ) : tab === 'stock' ? (
          <>
            <h4 className="sb-probe__section-title">
              재고 ({formatNumber(data.stock.length)}행 · 수량 {formatNumber(data.summary.stockQty)})
            </h4>
            <div className="sb-probe__table-wrap sb-probe__table-wrap--scroll">
              <table className="sb-probe__table sb-probe__table--compact">
                <thead>
                  <tr>
                    <ProbeTh label="창고" keyName="warehouse" />
                    <ProbeTh label="품목코드" keyName="itemCode" />
                    <ProbeTh label="품목명" keyName="itemName" />
                    <ProbeTh label="로트" keyName="lotNo" />
                    <ProbeTh label="유통기한" keyName="expireDate" />
                    <ProbeTh label="잔여일" keyName="remainingDays" />
                    <ProbeTh label="수량" keyName="qty" />
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="sb-probe__muted">
                        재고 없음
                      </td>
                    </tr>
                  ) : (
                    data.stock.slice(0, 200).map((row, index) => (
                      <tr key={`${row.itemCode}-${row.lotNo}-${index}`}>
                        <td>{row.warehouse || '—'}</td>
                        <td className="sb-probe__mono">{row.itemCode || '—'}</td>
                        <td className="sb-probe__truncate">{row.itemName || '—'}</td>
                        <td className="sb-probe__mono">{row.lotNo || '—'}</td>
                        <td className="sb-probe__mono">{row.expireDate || '—'}</td>
                        <td>{row.remainingDays != null ? formatNumber(row.remainingDays) : '—'}</td>
                        <td>{formatNumber(row.qty)}</td>
                        <td>
                          <button type="button" className="sb-probe__link-btn" onClick={() => openStockDetail(row)}>
                            상세보기
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data.stock.length > 200 ? <p className="sb-probe__muted">상위 200건만 표시합니다.</p> : null}
          </>
        ) : tab === 'channels' ? (
          <>
            <h4 className="sb-probe__section-title">채널별 합계</h4>
            <div className="sb-probe__table-wrap">
              <table className="sb-probe__table">
                <thead>
                  <tr>
                    <th>채널</th>
                    <th>줄수</th>
                    <th>수량</th>
                    <th>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="sb-probe__muted">
                        채널 집계 없음
                      </td>
                    </tr>
                  ) : (
                    data.channels.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{formatNumber(row.lines)}</td>
                        <td>{formatNumber(row.qty)}</td>
                        <td>{formatWon(row.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h4 className="sb-probe__section-title">기초정보 ({formatNumber(data.base.length)}건)</h4>
            <div className="sb-probe__table-wrap sb-probe__table-wrap--scroll">
              <table className="sb-probe__table sb-probe__table--compact">
                <thead>
                  <tr>
                    <th>종류</th>
                    <th>코드</th>
                    <th>이름</th>
                  </tr>
                </thead>
                <tbody>
                  {data.base.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="sb-probe__muted">
                        기초정보 없음
                      </td>
                    </tr>
                  ) : (
                    data.base.slice(0, 300).map((row, index) => (
                      <tr key={`${row.kind}-${row.code}-${index}`}>
                        <td>{row.kind || '—'}</td>
                        <td className="sb-probe__mono">{row.code || '—'}</td>
                        <td>{row.name || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {detail ? <DetailModal title={detail.title} rows={detail.rows} onClose={() => setDetail(null)} /> : null}
    </section>
  )
}
