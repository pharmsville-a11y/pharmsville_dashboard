import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { ROLES, ROLE_LABEL, displayName, useAuth, useCurrentUser } from '../auth'
import type { AppUser, Role } from '../auth/types'
import { usePageReady } from '../hooks/usePageReady'
import { showAppToast } from '../lib/appToast'
import './AccountsPage.css'

type AccountDraftRow = {
  name: string
  note: string
  role: Role
  password: string
}

function draftFromAccounts(accounts: AppUser[]): Record<string, AccountDraftRow> {
  return Object.fromEntries(
    accounts.map((account) => [
      account.id,
      {
        name: account.name ?? '',
        note: account.note ?? '',
        role: account.role,
        password: '',
      },
    ]),
  )
}

function isDraftDirty(accounts: AppUser[], draft: Record<string, AccountDraftRow>): boolean {
  for (const account of accounts) {
    const row = draft[account.id]
    if (!row) continue
    if (row.name !== (account.name ?? '')) return true
    if (row.note !== (account.note ?? '')) return true
    if (row.role !== account.role) return true
    if (row.password.length > 0) return true
  }
  return false
}

export function AccountsPage() {
  const actor = useCurrentUser()
  const { accounts, createAccount, grantRole, updateAccount, deleteAccount } = useAuth()
  usePageReady('accounts')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [role, setRole] = useState<Role>('manager')
  const [draft, setDraft] = useState<Record<string, AccountDraftRow>>(() => draftFromAccounts(accounts))
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(draftFromAccounts(accounts))
  }, [accounts])

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  const dirty = useMemo(() => isDraftDirty(accounts, draft), [accounts, draft])

  function patchDraft(userId: string, patch: Partial<AccountDraftRow>) {
    setDraft((current) => ({
      ...current,
      [userId]: { ...current[userId], ...patch },
    }))
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== passwordConfirm) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    try {
      const created = await createAccount({
        loginId,
        password,
        name,
        note,
        role,
        allowedChannels: 'ALL',
      })
      setLoginId('')
      setPassword('')
      setPasswordConfirm('')
      setName('')
      setNote('')
      setRole('manager')
      showAppToast(`${created.loginId} 계정을 만들었습니다.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '계정을 만들지 못했습니다.')
    }
  }

  async function handleSave() {
    if (!dirty) return
    setError('')
    try {
      for (const account of accounts) {
        const row = draft[account.id]
        if (!row) continue

        const patch: { name?: string; note?: string; password?: string } = {}
        if (row.name !== (account.name ?? '')) patch.name = row.name
        if (row.note !== (account.note ?? '')) patch.note = row.note
        if (row.password.length > 0) patch.password = row.password

        if (Object.keys(patch).length > 0) {
          await updateAccount(account.id, patch)
        }
        if (row.role !== account.role) {
          grantRole(account.id, row.role)
        }
      }
      showAppToast('저장되었습니다.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '계정을 저장하지 못했습니다.')
    }
  }

  function handleCancel() {
    setDraft(draftFromAccounts(accounts))
    setError('')
  }

  function handleDelete(userId: string, label: string) {
    if (!window.confirm(`${label} 계정을 삭제할까요?`)) return
    setError('')
    try {
      deleteAccount(userId)
      showAppToast(`${label} 계정을 삭제했습니다.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '계정을 삭제하지 못했습니다.')
    }
  }

  return (
    <section className="accounts is-enter">
      <header className="accounts__head">
        <h2>계정 관리</h2>
        <p>
          사용자명·비고·등급·비밀번호는 표에서 수정한 뒤 저장을 눌러야 반영됩니다. 현재 로그인:{' '}
          {displayName(actor)}
        </p>
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
            placeholder="화면에 보일 이름"
            required
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

      <div className="accounts__table-wrap">
        <table className="accounts__table">
          <thead>
            <tr>
              <th>계정 ID</th>
              <th>사용자명</th>
              <th>비고</th>
              <th>등급</th>
              <th>비밀번호</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const row = draft[account.id] ?? {
                name: account.name ?? '',
                note: account.note ?? '',
                role: account.role,
                password: '',
              }
              return (
                <tr key={account.id}>
                  <td>
                    <code className="accounts__login-id">{account.loginId}</code>
                  </td>
                  <td>
                    <input
                      className="accounts__cell-input accounts__cell-name"
                      value={row.name}
                      placeholder="화면에 보일 이름"
                      aria-label={`${account.loginId} 사용자명`}
                      onChange={(event) => patchDraft(account.id, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="accounts__cell-input accounts__cell-note"
                      value={row.note}
                      placeholder="비고"
                      aria-label={`${account.name} 비고`}
                      onChange={(event) => patchDraft(account.id, { note: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={row.role}
                      onChange={(event) => patchDraft(account.id, { role: event.target.value as Role })}
                    >
                      {ROLES.map((item) => (
                        <option key={item} value={item}>
                          {ROLE_LABEL[item]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="accounts__cell-input accounts__cell-password"
                      type="password"
                      value={row.password}
                      placeholder="변경 시 입력"
                      aria-label={`${account.loginId} 새 비밀번호`}
                      autoComplete="new-password"
                      onChange={(event) => patchDraft(account.id, { password: event.target.value })}
                    />
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
              )
            })}
          </tbody>
        </table>
      </div>

      <footer className="accounts__actions">
        <button type="button" className="accounts__cancel" disabled={!dirty} onClick={handleCancel}>
          취소
        </button>
        <button type="button" className="accounts__save" disabled={!dirty} onClick={() => void handleSave()}>
          저장
        </button>
      </footer>
    </section>
  )
}
