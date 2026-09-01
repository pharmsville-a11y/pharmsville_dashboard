import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { HOURLY_UPDATE_PREVIEW_EVENT, requestHourlyRefresh } from '../../lib/hourlyRefresh'
import {
  isPastKstCollect,
  kstHour,
  kstHourStamp,
  msUntilNextKstCollect,
} from '../../lib/kst'
import './HourlyUpdateToast.css'

/** cron: :02 collect-daily, :05 collect-pluscl — 마지막 수집 끝난 뒤 */
const COLLECT_MINUTE = 5
const COLLECT_GRACE_MS = 45_000
const POLL_MS = 30_000

export function HourlyUpdateToast() {
  const [hour, setHour] = useState<number | null>(null)
  const seenStamp = useRef(kstHourStamp())

  const check = useCallback(() => {
    if (!isPastKstCollect(new Date(), COLLECT_MINUTE, COLLECT_GRACE_MS)) return
    const stamp = kstHourStamp()
    if (stamp === seenStamp.current) return
    setHour(kstHour())
  }, [])

  useEffect(() => {
    let timeoutId = 0

    function schedule() {
      timeoutId = window.setTimeout(() => {
        check()
        schedule()
      }, msUntilNextKstCollect(new Date(), COLLECT_MINUTE, COLLECT_GRACE_MS))
    }

    schedule()
    const pollId = window.setInterval(check, POLL_MS)

    function onVisible() {
      if (document.visibilityState === 'visible') check()
    }

    function onPreview() {
      setHour(kstHour())
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(HOURLY_UPDATE_PREVIEW_EVENT, onPreview)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(HOURLY_UPDATE_PREVIEW_EVENT, onPreview)
    }
  }, [check])

  function dismiss() {
    seenStamp.current = kstHourStamp()
    setHour(null)
  }

  function apply() {
    dismiss()
    requestHourlyRefresh()
  }

  if (hour == null) return null

  return (
    <div className="hourly-toast" role="status" aria-live="polite">
      <span className="hourly-toast__icon" aria-hidden>
        <RefreshCw size={16} strokeWidth={2.2} />
      </span>
      <p className="hourly-toast__copy">
        <strong>{hour}시</strong>에 업데이트된 내용이 있습니다. 업데이트하시겠습니까?
      </p>
      <div className="hourly-toast__actions">
        <button type="button" className="hourly-toast__later" onClick={dismiss}>
          나중에
        </button>
        <button type="button" className="hourly-toast__apply" onClick={apply}>
          업데이트
        </button>
      </div>
      <button type="button" className="hourly-toast__close" onClick={dismiss} aria-label="닫기">
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  )
}
