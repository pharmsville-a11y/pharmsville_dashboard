import { usePageLoad } from './PageLoadContext'
import './PageLoadBar.css'

export function PageLoadBar() {
  const { visible, percent } = usePageLoad()
  const width = Math.max(0, Math.min(100, percent))

  return (
    <div
      className={visible ? 'page-load-bar is-on' : 'page-load-bar'}
      role="progressbar"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={visible ? Math.round(width) : 0}
      aria-label="페이지 불러오는 중"
    >
      <div className="page-load-bar__fill" style={{ width: `${width}%` }} />
    </div>
  )
}
