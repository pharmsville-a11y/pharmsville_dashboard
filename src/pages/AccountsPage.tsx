import { type FormEvent, useState } from 'react'
import { ROLES, ROLE_LABEL, useAuth, useCurrentUser } from '../auth'
import type { Role } from '../auth/types'
import './AccountsPage.css'

export function AccountsPage() {
  const actor = useCurrentUser()
  const { accounts, createAccount, grantRole } = useAuth()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('manager')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const created = createAccount({
        name,
        role,
        allowedChannels: 'ALL',
      })
      setName('')
      setRole('manager')
      setMessage(`${created.name} 계정을 만들었습니다.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '계정을 만들지 못했습니다.')
    }
  }

  function handleGrant(userId: string, nextRole: Role) {
    setError('')
    setMessage('')
    try {
      grantRole(userId, nextRole)
      setMessage('권한을 변경했습니다.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '권한을 변경하지 못했습니다.')
    }
  }

  return (
    <section className="accounts">
      <header className="accounts__head">
        <h2>계정 관리</h2>
        <p>최고관리자만 계정을 만들고 등급을 부여할 수 있습니다. 현재 로그인: {actor.name}</p>
      </header>

      <form className="accounts__form" onSubmit={handleCreate}>
        <label>
          사용자명
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
            required
          />
        </label>
        <label>
          권한 등급
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">계정 생성</button>
      </form>

      {error ? <p className="accounts__error">{error}</p> : null}
      {message ? <p className="accounts__ok">{message}</p> : null}

      <div className="accounts__table-wrap">
        <table className="accounts__table">
          <thead>
            <tr>
              <th>사용자</th>
              <th>등급</th>
              <th>허용 채널</th>
              <th>권한 변경</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <strong>{account.name}</strong>
                  <span>{account.title}</span>
                </td>
                <td>{ROLE_LABEL[account.role]}</td>
                <td>{account.allowedChannels === 'ALL' ? 'ALL' : account.allowedChannels.join(', ')}</td>
                <td>
                  <select
                    value={account.role}
                    onChange={(event) => handleGrant(account.id, event.target.value as Role)}
                  >
                    {ROLES.map((item) => (
                      <option key={item} value={item}>
                        {ROLE_LABEL[item]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
