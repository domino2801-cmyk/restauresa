import { useCallback, useEffect, useState } from 'react'

/**
 * Exécute une fonction asynchrone et expose son état.
 * La fonction est ré-exécutée lorsque sa référence change (utiliser useCallback) ;
 * les réponses obsolètes (changement rapide de paramètres) sont ignorées.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {{ data: T|undefined, error: Error|null, loading: boolean, reload: () => Promise<void> }}
 */
export function useAsync(fn) {
  const [state, setState] = useState({ fn, data: undefined, error: null, loading: true })

  // Nouvelle fonction (paramètres modifiés) : passage en chargement, sans effet.
  if (state.fn !== fn) setState((s) => ({ ...s, fn, loading: true, error: null }))

  useEffect(() => {
    let cancelled = false
    fn().then(
      (data) => !cancelled && setState({ fn, data, error: null, loading: false }),
      (error) => !cancelled && setState((s) => ({ ...s, error, loading: false })),
    )
    return () => {
      cancelled = true
    }
  }, [fn])

  const reload = useCallback(async () => {
    try {
      const data = await fn()
      setState({ fn, data, error: null, loading: false })
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }))
    }
  }, [fn])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
