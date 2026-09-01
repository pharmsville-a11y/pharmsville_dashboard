const inflight = new Map<string, Promise<unknown>>()

/** StrictMode·연속 마운트에서 같은 조회가 두 번 나가지 않게 한다. */
export function shareInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const pending = run().finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key)
  })
  inflight.set(key, pending)
  return pending
}
