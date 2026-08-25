import { type FormEvent, useEffect, useState } from 'react'
import { ROLES, ROLE_LABEL, displayName, useAuth, useCurrentUser } from '../auth'
import type { Role } from '../auth/types'
import { usePageReady } from '../hooks/usePageReady'
import './AccountsPage.css'

export function AccountsPage() {
  const actor = useCurrentUser()
  const { accounts, createAccount, grantRole, updateAccount, deleteAccount } = useAuth()
  usePageReady('accounts')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [note, setNote] = useState('')
  const [role, setRole] = useState<Role>('manager')
  const [resets, setResets] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!error && !message) return
    const timer = window.setTimeout(() => {
      setError('')
      setMessage('')
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [error, message])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    try {
      const created = await createAccount({
        loginId,
        password,
        name,
        nickname,
        note,
        role,
        allowedChannels: 'ALL',
      })
      setLoginId('')
      setPassword('')
      setPasswordConfirm('')
      setName('')
      setNickname('')
      setNote('')
      setRole('manager')
      setMessage(`${created.loginId} 계정을 만들었습니다.`)
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

  function handlePatch(userId: string, patch: { nickname?: string; note?: string }) {
    setError('')
    void updateAccount(userId, patch).catch((caught) => {
      setError(caught instanceof Error ? caught.message : '계정을 수정하지 못했습니다.')
    })
  }

  async function handleResetPassword(userId: string, login: string) {
    const next = resets[userId] ?? ''
    setError('')
    setMessage('')
    try {
      await updateAccount(userId, { password: next })
      setResets((current) => ({ ...current, [userId]: '' }))
      setMessage(`${login} 비밀번호를 변경했습니다.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '비밀번호를 변경하지 못했습니다.')
    }
  }

  function handleDelete(userId: string, label: string) {
    if (!window.confirm(`${label} 계정을 삭제할까요?`)) return
    setError('')
    setMessage('')
    try {
      deleteAccount(userId)
      setMessage(`${label} 계정을 삭제했습니다.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '계정을 삭제하지 못했습니다.')
    }
  }

  return (
    <section className="accounts is-enter">
      <header className="accounts__head">
        <h2>계정 관리</h2>
        <p>최고관리자가 계정 ID와 비밀번호를 발급합니다. 현재 로그인: {displayName(actor)}</p>
      </header>

      <form className="accounts__form" onSubmit={(event) => void handleCreate(event)}>
        <label>
          계정 ID
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="로그인에 사용할 ID"
            autoComplete="off"
            required
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="6자 이상"
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          비밀번호 확인
          <input
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="다시 입력"
            autoComplete="new-password"
            required
          />
        </label>
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
          별명
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="화면에 보일 이름"
          />
        </label>
        <label className="accounts__form-note">
          비고
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="메모"
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
              <th>계정 ID</th>
              <th>별명</th>
              <th>비고</th>
              <th>등급</th>
              <th>비밀번호</th>
              <th>권한 변경</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  <strong>{account.name}</strong>
                  <span>{account.title}</span>
                </td>
                <td>
                  <code className="accounts__login-id">{account.loginId}</code>
                </td>
                <td>
                  <input
                    className="accounts__cell-input"
                    value={account.nickname ?? ''}
                    placeholder="별명"
                    aria-label={`${account.name} 별명`}
                    onChange={(event) => handlePatch(account.id, { nickname: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="accounts__cell-input accounts__cell-note"
                    value={account.note ?? ''}
                    placeholder="비고"
                    aria-label={`${account.name} 비고`}
                    onChange={(event) => handlePatch(account.id, { note: event.target.value })}
                  />
                </td>
                <td>{ROLE_LABEL[account.role]}</td>
                <td>
                  <div className="accounts__reset">
                    <input
                      className="accounts__cell-input"
                      type="password"
                      value={resets[account.id] ?? ''}
                      placeholder="새 비밀번호"
                      aria-label={`${account.loginId} 새 비밀번호`}
                      autoComplete="new-password"
                      onChange={(event) =>
                        setResets((current) => ({ ...current, [account.id]: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="accounts__reset-btn"
                      disabled={!(resets[account.id] ?? '').length}
                      onClick={() => void handleResetPassword(account.id, account.loginId)}
                    >
                      변경
                    </button>
                  </div>
                </td>
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
                <td>
                  <button
                    type="button"
                    className="accounts__delete"
                    disabled={account.id === actor.id}
                    onClick={() => handleDelete(account.id, account.loginId)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
