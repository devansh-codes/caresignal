import { useEffect, useState } from 'react'
import type { Accuracy, Dq, Hospital, IndexEntry, Manifest, Measures, National, PeerFile } from './types'

const BASE = `${import.meta.env.BASE_URL}data/`
const cache = new Map<string, Promise<unknown>>()

export function fetchJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(`${r.status} loading ${path}`)
        return r.json()
      }),
    )
  }
  return cache.get(path) as Promise<T>
}

export const loadIndex = () => fetchJson<IndexEntry[]>('index.json')
export const loadHospital = (ccn: string) => fetchJson<Hospital>(`hospitals/${ccn}.json`)
export const loadPeers = (key: string) => fetchJson<PeerFile>(`peers/${key}.json`)
export const loadNational = () => fetchJson<National>('national.json')
export const loadManifest = () => fetchJson<Manifest>('manifest.json')
export const loadAccuracy = () => fetchJson<Accuracy>('accuracy.json')
export const loadDq = () => fetchJson<Dq>('dq.json')
export const loadMeasures = () => fetchJson<Measures>('measures.json')

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T }

/** Generic loader hook: every page renders explicit loading / error / ready states. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    loader()
      .then((data) => live && setState({ status: 'ready', data }))
      .catch((e: Error) => live && setState({ status: 'error', error: e.message }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
