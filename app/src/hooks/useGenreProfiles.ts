import { useCallback, useEffect, useState } from 'react'
import type { GenreProfileSummary } from '../types/inkforge'

export function useGenreProfiles() {
  const [profiles, setProfiles] = useState<GenreProfileSummary[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const reload = useCallback(async () => {
    setState('loading')
    try {
      if (!window.inkforge) throw new Error('Desktop bridge unavailable')
      setProfiles(await window.inkforge.library.listGenreProfiles())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(reload)
  }, [reload])

  return { profiles, state, reload }
}
