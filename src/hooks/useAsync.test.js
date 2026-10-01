import { act, renderHook, waitFor } from '@testing-library/react'
import { useAsync } from './useAsync'

function deferred() {
  let resolve
  const promise = new Promise((r) => (resolve = r))
  return { promise, resolve }
}

describe('useAsync', () => {
  it('charge les données de la fonction', async () => {
    const fn = () => Promise.resolve(42)
    const { result } = renderHook(() => useAsync(fn))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toBe(42))
    expect(result.current.loading).toBe(false)
  })

  it("ignore un rechargement obsolète lorsque les paramètres changent", async () => {
    const slow = deferred()
    let calls = 0
    const fnA = () => (++calls === 1 ? Promise.resolve('A') : slow.promise)
    const fnB = () => Promise.resolve('B')
    const { result, rerender } = renderHook(({ fn }) => useAsync(fn), { initialProps: { fn: fnA } })
    await waitFor(() => expect(result.current.data).toBe('A'))

    let pendingReload
    act(() => {
      pendingReload = result.current.reload()
    })
    rerender({ fn: fnB })
    await waitFor(() => expect(result.current.data).toBe('B'))

    await act(async () => {
      slow.resolve('A-obsolète')
      await pendingReload
    })
    expect(result.current.data).toBe('B')
  })
})
