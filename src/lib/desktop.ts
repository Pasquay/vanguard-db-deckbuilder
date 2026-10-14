// Desktop bridge. Prefers the preload IPC bridge; falls back to same-origin
// HTTP (the packaged server exposes the same operations). Never rejects for
// state queries — returns nulls so callers degrade gracefully in plain browsers.
interface BridgeApi {
  getState: () => Promise<{ cardDbDir: string | null }>
  pickFolder: () => Promise<string | null>
  rescan: () => Promise<{ ok: boolean; total?: number; error?: string }>
  exportPdf: (title: string) => Promise<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>
}

const bridge: BridgeApi | undefined =
  (window as unknown as { vg?: BridgeApi }).vg

async function post<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!r.ok) throw new Error(`Server ${r.status}`)
  return r.json() as Promise<T>
}

export interface DesktopApi {
  /** True when the native preload bridge is alive. */
  hasBridge: boolean
  getState: () => Promise<{ cardDbDir: string | null; exists?: boolean }>
  pickFolder: () => Promise<string | null>
  rescan: () => Promise<{ ok: boolean; total?: number; error?: string }>
  exportPdf: (title: string) => Promise<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>
}

export const desktop: DesktopApi = {
  hasBridge: !!bridge,

  getState: async () => {
    if (bridge) {
      try {
        return await bridge.getState()
      } catch { /* fall through to HTTP */ }
    }
    try {
      return await post<{ cardDbDir: string | null }>('/api/desktop-state')
    } catch {
      return { cardDbDir: null }
    }
  },

  pickFolder: async () => {
    if (bridge) {
      try {
        const d = await bridge.pickFolder()
        if (d) return d
      } catch { /* fall through to HTTP */ }
    }
    try {
      const r = await post<{ dir: string | null }>('/api/pick-folder')
      return r.dir
    } catch {
      return null
    }
  },

  rescan: async () => {
    if (bridge) {
      try {
        return await bridge.rescan()
      } catch { /* fall through to HTTP */ }
    }
    try {
      return await post<{ ok: boolean; total?: number; error?: string }>('/api/rescan')
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  exportPdf: async (title: string) => {
    if (bridge) {
      try {
        return await bridge.exportPdf(title)
      } catch { /* fall through to HTTP */ }
    }
    try {
      return await post<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>('/api/export-pdf', { title })
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },
}
