import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical } from 'lucide-react'
import { ROLES, ROLE_LABEL, useCurrentUser } from '../auth'
import type { Role } from '../auth/types'
import { usePageReady } from '../hooks/usePageReady'
import { showAppToast } from '../lib/appToast'
import { cx } from '../lib/cx'
import {
  NAV_LABEL_MAX,
  PAGE_IDS,
  PAGE_LABEL,
  defaultNavConfig,
  pageLabel,
  sanitizeNavLabel,
  sidebarOrder,
  withSettingsOrder,
  type NavConfig,
} from '../nav/catalog'
import { isNavLocked } from '../nav/config'
import { useNavConfig } from '../nav/NavConfigProvider'
import type { PageId } from '../components/layout/types'
import './MenuSettingsPage.css'

function cloneConfig(config: NavConfig): NavConfig {
  return structuredClone(config)
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function sameConfig(a: NavConfig, b: NavConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function slotIndex(slots: number[], y: number): number {
  if (slots.length === 0) return 0
  let best = 0
  let closest = Number.POSITIVE_INFINITY
  slots.forEach((mid, index) => {
    const distance = Math.abs(y - mid)
    if (distance < closest) {
      closest = distance
      best = index
    }
  })
  return best
}

function shiftY(index: number, from: number, over: number, stride: number): number {
  if (from < over && index > from && index <= over) return -stride
  if (from > over && index >= over && index < from) return stride
  return 0
}

type DragSession = {
  from: number
  over: number
  pageId: PageId
  left: number
  width: number
  height: number
  stride: number
  slots: number[]
  tops: number[]
}

function RoleSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className={cx('role-switch', disabled && 'is-locked')}>
      <span className="role-switch__name">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="role-switch__track"
        onClick={() => {
          if (disabled) return
          onChange(!checked)
        }}
      >
        <span className="role-switch__thumb" />
      </button>
    </div>
  )
}

export function MenuSettingsPage() {
  const actor = useCurrentUser()
  const { config, setConfig } = useNavConfig()
  const [draft, setDraft] = useState<NavConfig>(() => cloneConfig(config))
  const [drag, setDrag] = useState<DragSession | null>(null)
  const dragRef = useRef<DragSession | null>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])
  usePageReady('menu')

  useEffect(() => {
    setDraft(cloneConfig(config))
  }, [config])

  const rows = useMemo(() => sidebarOrder(draft.order), [draft.order])
  const dirty = !sameConfig(draft, config)
  const canEdit = actor.role === 'admin'

  function updateDraft(patch: (current: NavConfig) => NavConfig) {
    if (!canEdit) return
    setDraft((current) => patch(current))
  }

  function toggle(pageId: PageId, role: Role, checked: boolean) {
    if (isNavLocked(role, pageId)) return
    updateDraft((current) => ({
      ...current,
      roles: {
        ...current.roles,
        [pageId]: { ...current.roles[pageId], [role]: checked },
      },
    }))
  }

  function rename(pageId: PageId, value: string) {
    updateDraft((current) => ({
      ...current,
      labels: { ...current.labels, [pageId]: value.slice(0, NAV_LABEL_MAX) },
    }))
  }

  function commitLabel(pageId: PageId) {
    updateDraft((current) => ({
      ...current,
      labels: {
        ...current.labels,
        [pageId]: sanitizeNavLabel(current.labels[pageId] ?? '', PAGE_LABEL[pageId]),
      },
    }))
  }

  function handleGripPointerDown(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (!canEdit || event.button !== 0) return
    const el = itemRefs.current[index]
    if (!el) return
    event.preventDefault()
    const rect = el.getBoundingClientRect()
    const next = itemRefs.current[index + 1]
    const prev = itemRefs.current[index - 1]
    const gap = next
      ? next.getBoundingClientRect().top - rect.bottom
      : prev
        ? rect.top - prev.getBoundingClientRect().bottom
        : 10
    const boxes = itemRefs.current.map((item) => item?.getBoundingClientRect() ?? null)
    const session: DragSession = {
      from: index,
      over: index,
      pageId: rows[index],
      left: rect.left,
      width: rect.width,
      height: rect.height,
      stride: rect.height + gap,
      slots: boxes.map((box) => (box ? box.top + box.height / 2 : 0)),
      tops: boxes.map((box) => box?.top ?? 0),
    }
    dragRef.current = session
    setDrag(session)
  }

  const isSorting = drag !== null

  useEffect(() => {
    if (!isSorting) return

    function onMove(event: PointerEvent) {
      const session = dragRef.current
      if (!session) return
      event.preventDefault()
      const over = slotIndex(session.slots, event.clientY)
      if (over === session.over) return
      const next = { ...session, over }
      dragRef.current = next
      setDrag(next)
    }

    function onUp() {
      const session = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!session || session.from === session.over) return
      setDraft((current) => ({
        ...current,
        order: withSettingsOrder(moveItem(sidebarOrder(current.order), session.from, session.over)),
      }))
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.body.classList.add('is-nav-dragging')
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('is-nav-dragging')
    }
  }, [isSorting])

  function handleSave() {
    if (!canEdit || !dirty) return
    const next: NavConfig = {
      ...draft,
      order: withSettingsOrder(draft.order),
      labels: { ...PAGE_LABEL },
    }
    for (const id of PAGE_IDS) {
      next.labels[id] = sanitizeNavLabel(draft.labels[id] ?? '', PAGE_LABEL[id])
    }
    setConfig(next)
    showAppToast('저장되었습니다.')
  }

  function handleCancel() {
    dragRef.current = null
    setDrag(null)
    setDraft(cloneConfig(config))
  }

  const draggingId = drag?.pageId

  return (
    <section className={cx('menu-settings', 'is-enter', drag && 'is-sorting')}>
      <header className="menu-settings__head">
        <div>
          <h2>메뉴 설정</h2>
          <p>
            왼쪽 선을 잡고 원하는 자리로 옮긴 뒤 손을 떼면 순서가 바뀝니다. 이름과 노출은 저장을 눌러야
            사이드바에 반영됩니다.
          </p>
        </div>
        <button
          type="button"
          className="menu-settings__reset"
          disabled={!canEdit}
          onClick={() => setDraft(cloneConfig(defaultNavConfig()))}
        >
          기본값 불러오기
        </button>
      </header>

      <ol className="menu-settings__list" aria-label="사이드바 메뉴 순서">
        {rows.map((pageId, index) => {
          const lockedShift = drag ? shiftY(index, drag.from, drag.over, drag.stride) : 0
          return (
            <li
              key={pageId}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              className={cx('menu-settings__item', draggingId === pageId && 'is-dragging')}
              style={{ transform: lockedShift ? `translateY(${lockedShift}px)` : undefined }}
            >
              <button
                type="button"
                className="menu-settings__grip"
                aria-label={`${pageLabel(draft, pageId)} 순서 이동`}
                disabled={!canEdit}
                onPointerDown={(event) => handleGripPointerDown(event, index)}
              >
                <GripVertical size={18} />
              </button>
              <span className="menu-settings__index">{index + 1}</span>
              <input
                className="menu-settings__name"
                value={draft.labels[pageId] ?? PAGE_LABEL[pageId]}
                maxLength={NAV_LABEL_MAX}
                disabled={!canEdit}
                aria-label="메뉴 이름"
                onChange={(event) => rename(pageId, event.target.value)}
                onBlur={() => commitLabel(pageId)}
              />
              <div className="menu-settings__roles">
                {ROLES.map((role) => {
                  const locked = isNavLocked(role, pageId)
                  return (
                    <RoleSwitch
                      key={role}
                      label={ROLE_LABEL[role]}
                      checked={draft.roles[pageId]?.[role] === true}
                      disabled={locked || !canEdit}
                      onChange={(checked) => toggle(pageId, role, checked)}
                    />
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>

      {drag
        ? createPortal(
            <div
              className="menu-settings__ghost"
              style={{
                left: drag.left,
                top: drag.tops[drag.over] ?? drag.tops[drag.from],
                width: drag.width,
                height: drag.height,
              }}
            >
              <span className="menu-settings__grip" aria-hidden>
                <GripVertical size={18} />
              </span>
              <strong>{pageLabel(draft, drag.pageId)}</strong>
              <span className="menu-settings__ghost-hint">이 위치로 이동합니다</span>
            </div>,
            document.body,
          )
        : null}

      <footer className="menu-settings__actions">
        <button type="button" className="menu-settings__cancel" disabled={!dirty} onClick={handleCancel}>
          취소
        </button>
        <button type="button" className="menu-settings__save" disabled={!canEdit || !dirty} onClick={handleSave}>
          저장
        </button>
      </footer>
    </section>
  )
}
