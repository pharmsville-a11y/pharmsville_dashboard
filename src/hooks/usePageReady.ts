import { useEffect } from 'react'
import { usePageLoad } from '../components/layout/PageLoadContext'

export function usePageReady(readyKey?: string) {
  const { complete } = usePageLoad()

  useEffect(() => {
    complete()
  }, [complete, readyKey])
}
