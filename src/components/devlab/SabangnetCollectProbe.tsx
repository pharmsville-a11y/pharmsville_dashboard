import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Database, CloudDownload, Play, X } from 'lucide-react'
import { getChannel } from '../../channels/catalog'
import { DateField } from '../ui/DateField'
import { formatNumber, formatWon } from '../../lib/format'
import { kstYmd } from '../../lib/kst'
import {
  fetchSabangnetSnapshot,
  isSabangnetConfigured,
  sabangnetCollectUrl,
  sabangnetQueryUrl,
  triggerSabangnetCollect,
  type SabangnetCollectResult,
  type SabangnetSnapshot,
} from '../../services/querySabangnet'
import {
  fetchChannelSnapshotsOrEmpty,
  snapshotsQueryUrl,
  type ChannelSnapshotRow,
} from '../../services/querySnapshots'
import {
  formatSabangnetDateTimeValue,
  formatSabangnetInferredOrderTime,
  formatSabangnetOrderDt,
  resolveSabangnetOrderTime,
} from '../../lib/sabangnetOrderTime'
import { SABANGNET_ORDER_FIELDS } from '../../lib/sabangnetOrderFields'
import './SabangnetCollectProbe.css'

type TabId = 'api' | 'db'

function channelLabel(id: string): string {
  return getChannel(id)?.name ?? id
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function money(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function orderYmd(value: unknown): string {
  const digits = text(value).replace(/\D/g, '')
  if (digits.length < 8) return ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function orderDateTimeSortKey(row: Record<string, unknown>): number {
  const resolved = resolveSabangnetOrderTime(row)
  if (!resolved) return 0
  const { ymd, hour, minute, second } = resolved
  const digits = `${ymd.replace(/-/g, '')}${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}${String(second).padStart(2, '0')}`
  return Number(digits) || 0
}

function formatProbeCell(key: string, row: Record<string, unknown>): string {
  const value = row[key]
  if (value == null || String(value).trim() === '') return '—'
  if (
    key.endsWith('_DT') ||
    key === 'REG_DATE' ||
    key === 'HOPE_DELIVERY_DT'
  ) {
    return formatSabangnetDateTimeValue(value)
  }
  return String(value)
}

function ProbeTh({ label, keyName }: { label: string; keyName: string }) {
  return (
    <th>
      <span className="sb-probe__th-label">{label}</span>
      <span className="sb-probe__th-key">({keyName})</span>
    </th>
  )
}

function OrderDetailModal({
  row,
  onClose,
}: {
  row: Record<string, unknown> | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!row) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('is-sb-probe-modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-sb-probe-modal-open')
    }
  }, [row, onClose])

  if (!row) return null

  const title =
    text(row.SHOP_NM) && text(row.SB_ORD_NO)
      ? `${text(row.SHOP_NM)} · ${text(row.SB_ORD_NO)}`
      : text(row.SB_ORD_NO) || text(row.SHOP_ORD_NO) || '주문 상세'

  const filled = SABANGNET_ORDER_FIELDS.filter((field) => {
    const value = row[field.key]
    return value != null && String(value).trim() !== ''
  }).length

  return createPortal(
    <div className="sb-probe-modal" role="presentation" onClick={onClose}>
      <div
        className="sb-probe-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sb-probe-order-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sb-probe-modal__head">
          <div>
            <h3 id="sb-probe-order-detail-title">주문 상세 필드</h3>
            <p className="sb-probe-modal__sub">
              {title} · 값 있음 {filled}/{SABANGNET_ORDER_FIELDS.length}
              <br />
              주문수집필드값(ETC_FLD)은 몰마다 의미가 다릅니다. 항목 아래 회색 글씨는 최근 실데이터 기반 추정입니다.
            </p>
          </div>
          <button type="button" className="sb-probe-modal__close" aria-label="닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="sb-probe-modal__meta">
          <span>주문일시 {formatSabangnetOrderDt(row)}</span>
          <span>추정 {formatSabangnetInferredOrderTime(row)}</span>
          <span>상태 {text(row.ORDER_STATUS) || '—'}</span>
        </div>

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
              {SABANGNET_ORDER_FIELDS.map((field) => {
                const value = formatProbeCell(field.key, row)
                const empty = value === '—'
                return (
                  <tr key={field.key} className={empty ? 'is-empty' : undefined}>
                    <td className="sb-probe-modal__label">
                      <span className="sb-probe-modal__label-main">{field.label}</span>
                      {field.hint ? <span className="sb-probe-modal__hint">{field.hint}</span> : null}
                    </td>
                    <td className="sb-probe-modal__key">{field.key}</td>
                    <td className="sb-probe-modal__value">{value}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
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

export function SabangnetCollectProbe() {
  const today = kstYmd()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [tab, setTab] = useState<TabId>('api')
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiData, setApiData] = useState<SabangnetSnapshot | null>(null)
  const [dbRows, setDbRows] = useState<ChannelSnapshotRow[]>([])
  const [collectResult, setCollectResult] = useState<SabangnetCollectResult | null>(null)
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  const apiConfigured = isSabangnetConfigured()
  const dbConfigured = Boolean(snapshotsQueryUrl())
  const collectConfigured = Boolean(sabangnetCollectUrl())

  const sabangnetDbRows = useMemo(
    () => dbRows.filter((row) => row.source === 'sabangnet'),
    [dbRows],
  )

  const apiRowsForRange = useMemo(() => {
    if (!apiData) return []
    return apiData.rows
      .filter((row) => {
        const day = orderYmd(row.ORDER_DT) || orderYmd(row.COLLECT_DT)
        return day >= from && day <= to
      })
      .sort((a, b) => orderDateTimeSortKey(b) - orderDateTimeSortKey(a))
  }, [apiData, from, to])

  const apiAmountForRange = useMemo(() => {
    return apiRowsForRange.reduce(
      (sum, row) => sum + (money(row.PAY_TOT_AMT) || money(row.ORDER_TOT_AMT) || money(row.CT_SALE_COST)),
      0,
    )
  }, [apiRowsForRange])

  const dbByHour = useMemo(() => {
    const map = new Map<number, { channels: number; sales: number; orders: number; captured: string | null }>()
    for (const row of sabangnetDbRows) {
      const bucket = map.get(row.snapshot_hour) ?? { channels: 0, sales: 0, orders: 0, captured: null }
      bucket.channels += 1
      bucket.sales += row.sales
      bucket.orders += row.orders
      if (!bucket.captured || (row.captured_at && row.captured_at > bucket.captured)) {
        bucket.captured = row.captured_at
      }
      map.set(row.snapshot_hour, bucket)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [sabangnetDbRows])

  const dbLatestHour = dbByHour.at(-1)?.[0] ?? null
  const activeHour = selectedHour != null && dbByHour.some(([hour]) => hour === selectedHour)
    ? selectedHour
    : dbLatestHour

  useEffect(() => {
    if (dbLatestHour == null) {
      setSelectedHour(null)
      return
    }
    setSelectedHour((current) =>
      current != null && dbByHour.some(([hour]) => hour === current) ? current : dbLatestHour,
    )
  }, [dbByHour, dbLatestHour])

  const dbChannelRows = useMemo(() => {
    if (activeHour == null) return []
    return sabangnetDbRows
      .filter((row) => row.snapshot_hour === activeHour)
      .sort((a, b) => b.sales - a.sales || a.channel_id.localeCompare(b.channel_id, 'ko'))
  }, [sabangnetDbRows, activeHour])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tasks: Promise<void>[] = []
      if (apiConfigured) {
        tasks.push(
          fetchSabangnetSnapshot(from, to, 2, false).then((data) => {
            setApiData(data)
          }),
        )
      } else {
        setApiData(null)
      }
      if (dbConfigured) {
        tasks.push(
          fetchChannelSnapshotsOrEmpty(from, to, []).then((rows) => {
            setDbRows(rows)
          }),
        )
      } else {
        setDbRows([])
      }
      await Promise.all(tasks)
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [apiConfigured, dbConfigured, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const runCollect = async () => {
    if (!collectConfigured) return
    setCollecting(true)
    setError(null)
    try {
      const result = await triggerSabangnetCollect(to)
      setCollectResult(result)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '수집에 실패했습니다.')
    } finally {
      setCollecting(false)
    }
  }

  return (
    <section className="sb-probe" aria-label="사방넷 수집 데이터 확인">
      <header className="sb-probe__head">
        <div>
          <h3 className="sb-probe__title">사방넷 API 수집 확인</h3>
          <p className="sb-probe__desc">
            사방넷 API 실시간 조회와 DB <code>channel_snapshots</code> (source=sabangnet)를 비교합니다.
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
          <button
            type="button"
            className="sb-probe__btn"
            disabled={loading}
            onClick={() => void load()}
          >
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
        <span className={apiConfigured ? 'sb-probe__ok' : 'sb-probe__warn'}>
          API {apiConfigured ? sabangnetQueryUrl() : '미설정'}
        </span>
        <span className={dbConfigured ? 'sb-probe__ok' : 'sb-probe__warn'}>
          DB {dbConfigured ? snapshotsQueryUrl() : '미설정'}
        </span>
      </div>

      {error ? <p className="sb-probe__error" role="alert">{error}</p> : null}

      {collectResult ? (
        <div className="sb-probe__collect-result">
          <strong>수집 완료</strong>
          <span>{collectResult.snapshot_date}</span>
          <span>스냅샷 {formatNumber(collectResult.rows)}행</span>
          <span>주문줄 {formatNumber(collectResult.order_rows)}건</span>
        </div>
      ) : null}

      <div className="sb-probe__kpis">
        <article className="sb-probe__kpi">
          <span className="sb-probe__kpi-label">API 주문줄 (기간)</span>
          <strong>{formatNumber(apiRowsForRange.length)}</strong>
          <small>{formatWon(apiAmountForRange)}</small>
        </article>
        <article className="sb-probe__kpi">
          <span className="sb-probe__kpi-label">DB 스냅샷 행</span>
          <strong>{formatNumber(sabangnetDbRows.length)}</strong>
          <small>
            {dbLatestHour != null ? `최신 ${dbLatestHour}시 · ${dbChannelRows.length}채널` : '데이터 없음'}
          </small>
        </article>
        <article className="sb-probe__kpi">
          <span className="sb-probe__kpi-label">DB 최신 captured_at</span>
          <strong className="sb-probe__kpi-mono">
            {formatCaptured(dbChannelRows[0]?.captured_at ?? sabangnetDbRows.at(-1)?.captured_at ?? null)}
          </strong>
        </article>
      </div>

      <div className="sb-probe__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'api'}
          className={tab === 'api' ? 'is-active' : ''}
          onClick={() => setTab('api')}
        >
          <CloudDownload size={15} aria-hidden />
          API 실시간
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'db'}
          className={tab === 'db' ? 'is-active' : ''}
          onClick={() => setTab('db')}
        >
          <Database size={15} aria-hidden />
          DB 스냅샷
        </button>
      </div>

      {tab === 'api' ? (
        <div className="sb-probe__panel">
          {!apiConfigured ? (
            <p className="sb-probe__muted">VITE_QUERY_URL 또는 VITE_SABANGNET_URL 을 설정하세요.</p>
          ) : !apiData ? (
            <p className="sb-probe__muted">{loading ? '조회 중…' : '데이터가 없습니다.'}</p>
          ) : (
            <>
              {apiData.error ? <p className="sb-probe__error">{apiData.error}</p> : null}

              <h4 className="sb-probe__section-title">쇼핑몰별 합계 (API)</h4>
              <div className="sb-probe__table-wrap">
                <table className="sb-probe__table">
                  <thead>
                    <tr>
                      <th>쇼핑몰</th>
                      <th>주문줄</th>
                      <th>금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiData.shops.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="sb-probe__muted">
                          쇼핑몰 집계 없음
                        </td>
                      </tr>
                    ) : (
                      apiData.shops.map((shop) => (
                        <tr key={shop.name}>
                          <td>{shop.name}</td>
                          <td>{formatNumber(shop.count)}</td>
                          <td>{formatWon(shop.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h4 className="sb-probe__section-title">주문 상태</h4>
              <div className="sb-probe__chips">
                {Object.entries(apiData.statusCounts).map(([status, count]) => (
                  <span key={status} className="sb-probe__chip">
                    {status} <strong>{formatNumber(count)}</strong>
                  </span>
                ))}
              </div>

              <h4 className="sb-probe__section-title">
                주문 원본 ({from}~{to}, {formatNumber(apiRowsForRange.length)}건)
              </h4>
              <div className="sb-probe__table-wrap sb-probe__table-wrap--scroll">
                <table className="sb-probe__table sb-probe__table--compact">
                  <thead>
                    <tr>
                      <ProbeTh label="주문일시" keyName="ORDER_DT" />
                      <ProbeTh label="최초등록일시" keyName="REG_DATE" />
                      <ProbeTh label="주문확인일시" keyName="ORD_CM_DT" />
                      <ProbeTh label="추정주문시간" keyName="SHOP_ORD_NO" />
                      <ProbeTh label="시" keyName="집계" />
                      <ProbeTh label="쇼핑몰" keyName="SHOP_NM" />
                      <ProbeTh label="상태" keyName="ORDER_STATUS" />
                      <ProbeTh label="금액" keyName="PAY_TOT_AMT" />
                      <ProbeTh label="상품" keyName="CM_PRD_NM" />
                      <th>상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiRowsForRange.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="sb-probe__muted">
                          기간 내 ORDER_DT 주문 없음
                        </td>
                      </tr>
                    ) : (
                      apiRowsForRange.slice(0, 200).map((row, index) => {
                        const resolved = resolveSabangnetOrderTime(row)
                        const hour = resolved?.hour ?? null
                        return (
                          <tr key={`${text(row.SB_ORD_NO)}-${index}`}>
                            <td className="sb-probe__mono">{formatSabangnetOrderDt(row)}</td>
                            <td className="sb-probe__mono">{formatSabangnetDateTimeValue(row.REG_DATE)}</td>
                            <td className="sb-probe__mono">{formatSabangnetDateTimeValue(row.ORD_CM_DT)}</td>
                            <td className="sb-probe__mono">{formatSabangnetInferredOrderTime(row)}</td>
                            <td>{hour != null ? `${hour}시` : '—'}</td>
                            <td>{text(row.SHOP_NM) || '—'}</td>
                            <td>{text(row.ORDER_STATUS) || '—'}</td>
                            <td>
                              {formatWon(
                                money(row.PAY_TOT_AMT) || money(row.ORDER_TOT_AMT) || money(row.CT_SALE_COST),
                              )}
                            </td>
                            <td className="sb-probe__truncate">
                              {text(row.CM_PRD_NM) || text(row.CT_PRD_NM) || text(row.PRT_PRD_NM) || '—'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="sb-probe__link-btn"
                                onClick={() => setDetailRow(row)}
                              >
                                상세보기
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {apiRowsForRange.length > 200 ? (
                <p className="sb-probe__muted">상위 200건만 표시합니다.</p>
              ) : null}

              <OrderDetailModal row={detailRow} onClose={() => setDetailRow(null)} />

              {apiData.notes.length > 0 ? (
                <>
                  <h4 className="sb-probe__section-title">API 로그</h4>
                  <pre className="sb-probe__notes">{apiData.notes.join('\n')}</pre>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="sb-probe__panel">
          {!dbConfigured ? (
            <p className="sb-probe__muted">VITE_SNAPSHOTS_URL 또는 VITE_QUERY_URL 을 설정하세요.</p>
          ) : sabangnetDbRows.length === 0 ? (
            <p className="sb-probe__muted">{loading ? '조회 중…' : 'DB에 sabangnet 스냅샷이 없습니다.'}</p>
          ) : (
            <>
              <h4 className="sb-probe__section-title">시간대별 수집 현황</h4>
              <p className="sb-probe__muted">행을 클릭하면 아래 채널별 스냅샷이 해당 시각 기준으로 바뀝니다.</p>
              <div className="sb-probe__table-wrap">
                <table className="sb-probe__table">
                  <thead>
                    <tr>
                      <th>시</th>
                      <th>채널 수</th>
                      <th>매출 합계</th>
                      <th>주문 합계</th>
                      <th>captured_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbByHour.map(([hour, bucket]) => (
                      <tr
                        key={hour}
                        className={hour === activeHour ? 'is-selected sb-probe__row-click' : 'sb-probe__row-click'}
                        onClick={() => setSelectedHour(hour)}
                      >
                        <td>{hour}시</td>
                        <td>{formatNumber(bucket.channels)}</td>
                        <td>{formatWon(bucket.sales)}</td>
                        <td>{formatNumber(bucket.orders)}</td>
                        <td className="sb-probe__mono">{formatCaptured(bucket.captured)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h4 className="sb-probe__section-title">
                채널별 스냅샷 ({activeHour ?? '—'}시 기준 · {formatNumber(dbChannelRows.length)}채널)
              </h4>
              <div className="sb-probe__table-wrap sb-probe__table-wrap--scroll">
                <table className="sb-probe__table">
                  <thead>
                    <tr>
                      <th>채널</th>
                      <th>channel_id</th>
                      <th>매출</th>
                      <th>주문</th>
                      <th>captured_at</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbChannelRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="sb-probe__muted">
                          선택한 시각의 채널 스냅샷이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      dbChannelRows.map((row) => (
                        <tr key={`${row.channel_id}-${row.snapshot_hour}`}>
                          <td>{channelLabel(row.channel_id)}</td>
                          <td className="sb-probe__mono">{row.channel_id}</td>
                          <td>{formatWon(row.sales)}</td>
                          <td>{formatNumber(row.orders)}</td>
                          <td className="sb-probe__mono">{formatCaptured(row.captured_at)}</td>
                          <td>
                          {row.extra?.zero_order_day || row.extra?.hour_pad ? (
                            <span className="sb-probe__tag">0원 보강</span>
                          ) : (
                            '—'
                          )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
