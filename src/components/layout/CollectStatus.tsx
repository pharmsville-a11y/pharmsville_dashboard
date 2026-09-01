import { useEffect, useState } from 'react'
import { CloudDownload } from 'lucide-react'
import { HOURLY_REFRESH_EVENT } from '../../lib/hourlyRefresh'
import { kstYmd } from '../../lib/kst'
import { cx } from '../../lib/cx'
import { fetchCollectStatus, type CollectStatus } from '../../services/collectStatus'
import './CollectStatus.css'

const POLL_MS = 5 * 60_000
const STATE_LABEL = {
  ok: '정상',
  late: '지연',
  idle: '대기',
  error: '확인 불가',
} as const

function formatCaptured(date: Date): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  const today = kstYmd()
  const yesterday = kstYmd(new Date(), -1)
  if (ymd === today) return `오늘 ${clock}`
  if (ymd === yesterday) return `어제 ${clock}`
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date)
}

export function CollectStatusWidget() {
  const [status, setStatus] = useState<CollectStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false

    function load(manual = false) {
      if (manual) setRefreshing(true)
      void fetchCollectStatus()
        .then((next) => {
          if (!cancelled) setStatus(next)
        })
        .finally(() => {
          if (!cancelled && manual) setRefreshing(false)
        })
    }

    load()
    const pollId = window.setInterval(() => load(), POLL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }

    function onHourlyRefresh() {
      load(true)
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(HOURLY_REFRESH_EVENT, onHourlyRefresh)
    return () => {
      cancelled = true
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(HOURLY_REFRESH_EVENT, onHourlyRefresh)
    }
  }, [])

  function refresh() {
    setRefreshing(true)
    void fetchCollectStatus()
      .then(setStatus)
      .finally(() => setRefreshing(false))
  }

  const state = status?.state ?? 'idle'

  return (
    <button
      type="button"
      className={cx('collect-status', refreshing && 'is-refreshing')}
      onClick={refresh}
      title="최근 수집 시각 새로고침"
    >
      <div className="collect-status__head">
        <span className="collect-status__icon" aria-hidden>
          <CloudDownload size={15} />
        </span>
        <span className="collect-status__kicker">최근 수집</span>
        <span className={`collect-status__badge is-${state}`}>
          <span className="collect-status__dot" aria-hidden />
          {STATE_LABEL[state]}
        </span>
      </div>
      <p className="collect-status__time">
        {status?.capturedAt ? formatCaptured(status.capturedAt) : '아직 기록이 없습니다'}
      </p>
      {status?.parts.length ? <p className="collect-status__parts">{status.parts.join(' · ')}</p> : null}
    </button>
  )
}
