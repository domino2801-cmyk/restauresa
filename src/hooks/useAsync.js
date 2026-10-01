import { useCallback, useEffect, useRef, useState } from 'react'

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

  // Identifiant de la dernière requête : une réponse n'est appliquée que si
  // aucune requête plus récente (chargement ou rechargement) n'a été lancée.
  const latest = useRef(0)

  useEffect(() => {
    const id = ++latest.current
    let cancelled = false
    const isCurrent = () => !cancelled && id === latest.current
    fn().then(
      (data) => isCurrent() && setState({ fn, data, error: null, loading: false }),
      (error) => isCurrent() && setState((s) => ({ ...s, error, loading: false })),
    )
    return () => {
      cancelled = true
    }
  }, [fn])

  const reload = useCallback(async () => {
    const id = ++latest.current
    try {
      const data = await fn()
      if (id === latest.current) setState({ fn, data, error: null, loading: false })
    } catch (error) {
      if (id === latest.current) setState((s) => ({ ...s, error, loading: false }))
    }
  }, [fn])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
