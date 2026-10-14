// Desktop bridge. `window.vg` exists only inside the packaged Electron app;
// the browser dev setup simply skips everything guarded by `desktop`.
export interface DesktopApi {
  getState: () => Promise<{ cardDbDir: string | null }>
  pickFolder: () => Promise<string | null>
  rescan: () => Promise<{ ok: boolean; total?: number; error?: string }>
}

export const desktop: DesktopApi | undefined =
  (window as unknown as { vg?: DesktopApi }).vg
