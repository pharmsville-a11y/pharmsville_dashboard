import type { ReactNode } from 'react'
import { can } from './permissions'
import type { Capability } from './types'
import { useCurrentUser } from './AuthProvider'

export function IfCapable({
  capability,
  children,
}: {
  capability: Capability
  children: ReactNode
}) {
  const user = useCurrentUser()
  if (!can(user.role, capability)) return null
  return children
}
