import { useDevLabAccess } from '../auth/DevLabAccessProvider'
import { usePageReady } from '../hooks/usePageReady'
import './DevLabPage.css'

export function DevLabPage() {
  const { loaded, allowed, ip } = useDevLabAccess()
  usePageReady()

  if (!loaded) {
    return (
      <div className="dev-lab">
        <p className="dev-lab__muted">접근 권한을 확인하는 중…</p>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="dev-lab">
        <p className="dev-lab__muted">
          개인 실험실은 로컬 개발(<code>npm run dev</code>)에서만 사용할 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="dev-lab">
      <section className="dev-lab__hero">
        <h2 className="dev-lab__title">개인 실험실</h2>
        <p className="dev-lab__desc">
          로컬 전용 테스트 공간입니다. 실서버(EC2·GitHub Pages) 빌드에는 포함되지 않습니다.
        </p>
        {ip ? <p className="dev-lab__ip">현재 IP: {ip}</p> : null}
      </section>

      <section className="dev-lab__sandbox" aria-label="실험 영역">
        <p className="dev-lab__hint">실험용 UI·컴포넌트를 이 영역에 추가하세요.</p>
      </section>
    </div>
  )
}
