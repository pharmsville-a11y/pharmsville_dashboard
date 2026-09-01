import { useState } from 'react'
import { useDevLabAccess } from '../auth/DevLabAccessProvider'
import { PlusclCollectProbe } from '../components/devlab/PlusclCollectProbe'
import { SabangnetCollectProbe } from '../components/devlab/SabangnetCollectProbe'
import { usePageReady } from '../hooks/usePageReady'
import './DevLabPage.css'

type SourceId = 'sabangnet' | 'pluscl'

export function ApiCheckPage() {
  const { loaded, allowed } = useDevLabAccess()
  const [source, setSource] = useState<SourceId>('sabangnet')
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
          API체크는 로컬 개발(<code>npm run dev</code>)에서만 사용할 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="dev-lab">
      <section className="dev-lab__hero">
        <h2 className="dev-lab__title">API체크</h2>
        <p className="dev-lab__desc">
          사방넷·PlusCL API 실시간 조회와 수집 상태를 확인합니다. 로컬 전용이며 실서버 빌드에는 포함되지 않습니다.
        </p>
        <div className="dev-lab__source-tabs" role="tablist" aria-label="API 소스">
          <button
            type="button"
            role="tab"
            aria-selected={source === 'sabangnet'}
            className={source === 'sabangnet' ? 'is-active' : ''}
            onClick={() => setSource('sabangnet')}
          >
            사방넷
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'pluscl'}
            className={source === 'pluscl' ? 'is-active' : ''}
            onClick={() => setSource('pluscl')}
          >
            PlusCL
          </button>
        </div>
      </section>

      <section className="dev-lab__sandbox" aria-label="API 확인">
        {source === 'sabangnet' ? <SabangnetCollectProbe /> : <PlusclCollectProbe />}
      </section>
    </div>
  )
}
