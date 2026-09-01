import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { APP_TOAST_DURATION_MS, APP_TOAST_EVENT } from '../../lib/appToast'
import './HourlyUpdateToast.css'

const LEAVE_MS = 320

export function AppToast() {
  const [message, setMessage] = useState<string | null>(null)
  const [ticket, setTicket] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    function onToast(event: Event) {
      const next = (event as CustomEvent<{ message?: unknown }>).detail?.message
      if (typeof next !== 'string' || !next.trim()) return
      setLeaving(false)
      setMessage(next.trim())
      setTicket((current) => current + 1)
    }

    window.addEventListener(APP_TOAST_EVENT, onToast)
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast)
  }, [])

  useEffect(() => {
    if (!message || leaving) return
    const hideId = window.setTimeout(() => setLeaving(true), APP_TOAST_DURATION_MS)
    return () => window.clearTimeout(hideId)
  }, [leaving, message, ticket])

  useEffect(() => {
    if (!leaving) return
    const doneId = window.setTimeout(() => {
      setMessage(null)
      setLeaving(false)
    }, LEAVE_MS)
    return () => window.clearTimeout(doneId)
  }, [leaving])

  if (!message) return null

  function dismiss() {
    setLeaving(true)
  }

  return (
    <div
      className={leaving ? 'hourly-toast is-leaving' : 'hourly-toast'}
      role="status"
      aria-live="polite"
    >
      <span className="hourly-toast__icon" aria-hidden>
        <Check size={16} strokeWidth={2.2} />
      </span>
      <p className="hourly-toast__copy">{message}</p>
      <button type="button" className="hourly-toast__close" onClick={dismiss} aria-label="닫기">
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  )
}
