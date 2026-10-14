// Preload: minimal, auditable bridge between the UI and the main process.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('vg', {
  getState: () => ipcRenderer.invoke('vg:getState'),
  pickFolder: () => ipcRenderer.invoke('vg:pickFolder'),
  rescan: () => ipcRenderer.invoke('vg:rescan'),
})
