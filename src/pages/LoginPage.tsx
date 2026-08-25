import { type FormEvent, useState } from 'react'
import { useAuth } from '../auth'
import './LoginPage.css'

export function LoginPage() {
  const { login } = useAuth()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await login(loginId, password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login">
      <div className="login__panel">
        <p className="login__kicker">채널보드</p>
        <h1>로그인</h1>
        <p className="login__lead">계정 ID와 비밀번호는 최고관리자가 발급합니다.</p>
        <form className="login__form" onSubmit={handleSubmit}>
          <label>
            계정 ID
            <input
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              autoComplete="username"
              placeholder="계정 ID"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="비밀번호"
              required
            />
          </label>
          {error ? <p className="login__error">{error}</p> : null}
          <button type="submit" className="login__submit" disabled={pending}>
            {pending ? '확인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
