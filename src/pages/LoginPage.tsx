import { SEED_ACCOUNTS } from '../auth/accounts'
import { ROLE_LABEL } from '../auth/types'
import { useAuth } from '../auth'
import './LoginPage.css'

export function LoginPage() {
  const { login, accounts } = useAuth()
  const list = accounts.length ? accounts : SEED_ACCOUNTS

  return (
    <div className="login">
      <div className="login__panel">
        <p className="login__kicker">채널보드</p>
        <h1>계정으로 들어가기</h1>
        <p className="login__lead">
          최고관리자만 계정을 만들고 권한을 부여합니다. 마케터 계정에는 광고비·ROI가 데이터에서부터
          빠집니다.
        </p>
        <ul className="login__list">
          {list.map((account) => (
            <li key={account.id}>
              <button type="button" className="login__card" onClick={() => login(account.id)}>
                <span className="login__avatar">{account.initials}</span>
                <span className="login__meta">
                  <strong>{account.name}</strong>
                  <span>
                    {ROLE_LABEL[account.role]} · {account.title}
                  </span>
                  {account.note ? <em>{account.note}</em> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
