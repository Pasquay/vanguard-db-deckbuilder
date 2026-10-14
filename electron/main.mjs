// Electron main process: embedded Express serves dist/ + the user's CardDB,
// then opens it in a desktop window. No dev servers, no terminals needed.
import { app, BrowserWindow, dialog, ipcMain, utilityProcess } from 'electron'
import { deleteDeck, listDecks, saveDeck } from './deckfiles.mjs'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const isPackaged = app.isPackaged
// Dev: VanguardApp/ (run via `npx electron .`). Packaged: <resources>/app.asar.
const ROOT = isPackaged ? path.join(here, '..') : path.resolve(here, '..')
const DIST = path.join(ROOT, 'dist')
const SCRIPTS = isPackaged
  ? path.join(process.resourcesPath, 'scripts')
  : path.join(ROOT, 'scripts')

const userDir = () => app.getPath('userData')
const settingsPath = () => path.join(userDir(), 'settings.json')
const dataDir = () => path.join(userDir(), 'data')

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
  } catch {
    return {}
  }
}
function saveSettings(s) {
  fs.mkdirSync(userDir(), { recursive: true })
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2))
}

let cardDbDir = loadSettings().cardDbDir ?? null
// Default to the conventional location when nothing valid is saved.
function conventionalCardDb() {
  const cands = [path.join(app.getPath('documents'), 'TCG', 'Vanguard', 'CardDB')]
  for (const c of cands) {
    try {
      if (fs.statSync(c).isDirectory()) return c
    } catch { /* missing — try next */ }
  }
  return null
}
if (!cardDbDir || !fs.existsSync(cardDbDir)) {
  cardDbDir = conventionalCardDb()
}
let mainWindow = null

async function doPickFolder() {
  const r = await dialog.showOpenDialog(mainWindow ?? undefined, {
    title: 'Locate your CardDB folder',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory'],
  })
  if (r.canceled || !r.filePaths[0]) return null
  cardDbDir = r.filePaths[0]
  saveSettings({ ...loadSettings(), cardDbDir })
  return cardDbDir
}

async function doRescan() {
  if (!cardDbDir) return { ok: false, error: 'No CardDB folder selected.' }
  fs.mkdirSync(dataDir(), { recursive: true })
  const { code, log } = await runIndex(cardDbDir, dataDir())
  if (code !== 0) return { ok: false, error: log.slice(-500) || `Indexer exited with code ${code}` }
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dataDir(), 'meta.json'), 'utf-8'))
    return { ok: true, total: meta.total }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

async function doExportPdf(title, sender) {
  const win = (sender && BrowserWindow.fromWebContents(sender)) || mainWindow
  if (!win) return { ok: false, error: 'No window.' }
  try {
    // Same CSS print pipeline as window.print(), but with backgrounds forced
    // on and a real save dialog (deck name prefilled).
    const data = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      marginsType: 1,
    })
    const safe = String(title || 'proxies').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) || 'proxies'
    // Default save location: prints/ next to the user's CardDB (falls back
    // to Documents when no CardDB is set).
    const defaultDir = cardDbDir
      ? path.join(path.dirname(cardDbDir), 'prints')
      : app.getPath('documents')
    fs.mkdirSync(defaultDir, { recursive: true })
    const r = await dialog.showSaveDialog(win, {
      title: 'Save proxy PDF',
      defaultPath: path.join(defaultDir, `${safe}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (r.canceled || !r.filePath) return { ok: false, cancelled: true }
    await fs.promises.writeFile(r.filePath, data)
    return { ok: true, path: r.filePath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function createServer() {
  const server = express()
  server.use(express.json({ limit: '1mb' }))

  // User's CardDB (picked via dialog, may change at runtime -> dynamic lookup).
  server.use('/card-images', (req, res, next) => {
    if (!cardDbDir || !fs.existsSync(cardDbDir)) return res.status(404).end()
    express.static(cardDbDir, {
      fallthrough: true,
      setHeaders(r, fp) {
        if (/\.(png|jpg|jpeg|webp)$/i.test(fp)) r.setHeader('Cache-Control', 'public, max-age=86400')
      },
    })(req, res, next)
  })

  // Fresh index from rescan (userData) wins over the bundled one (dist).
  server.use('/data', (req, res, next) => {
    if (fs.existsSync(path.join(dataDir(), 'all-cards.json'))) {
      express.static(dataDir())(req, res, next)
    } else {
      next()
    }
  })
  server.use('/data', express.static(path.join(DIST, 'data')))
  server.use(express.static(DIST))
  server.get('/api/health', (_req, res) =>
    res.json({ ok: true, cardDbDir, hasIndex: fs.existsSync(path.join(dataDir(), 'all-cards.json')) }),
  )

  // ---- Deck files (<CardDB>/decks/[ERA] Vanguard.json) ----
  server.get('/api/decks', (_req, res) => {
    if (!cardDbDir) return res.status(409).json({ ok: false, error: 'No CardDB folder.' })
    res.json({ ok: true, decks: listDecks(cardDbDir) })
  })
  server.post('/api/decks', (req, res) => {
    if (!cardDbDir) return res.status(409).json({ ok: false, error: 'No CardDB folder.' })
    const { deck, file } = req.body ?? {}
    if (!deck || typeof deck.id !== 'string') return res.status(400).json({ ok: false, error: 'Bad deck.' })
    try {
      res.json({ ok: true, file: saveDeck(cardDbDir, deck, file ?? deck.name ?? 'Untitled') })
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) })
    }
  })
  server.delete('/api/decks/:id', (req, res) => {
    if (!cardDbDir) return res.status(409).json({ ok: false, error: 'No CardDB folder.' })
    res.json({ ok: deleteDeck(cardDbDir, req.params.id) })
  })

  // HTTP API (primary — works with or without the preload bridge).
  server.post('/api/desktop-state', (_req, res) => res.json({
    cardDbDir,
    exists: cardDbDir ? fs.existsSync(cardDbDir) : false,
  }))
  server.post('/api/pick-folder', async (_req, res) => res.json({ dir: await doPickFolder() }))
  server.post('/api/rescan', async (_req, res) => res.json(await doRescan()))
  server.post('/api/export-pdf', async (req, res) => res.json(await doExportPdf(req.body?.title, null)))
  // SPA fallback (we only have the one page, but harmless).
  server.use((_req, res) => res.sendFile(path.join(DIST, 'index.html')))
  return server
}

function runIndex(root, out) {
  return new Promise((resolve) => {
    const child = utilityProcess.fork(path.join(SCRIPTS, 'build-index.mjs'), ['--root', root, '--out', out])
    let outText = ''
    child.stdout?.on('data', (d) => { outText += String(d) })
    child.stderr?.on('data', (d) => { outText += String(d) })
    child.on('exit', (code) => resolve({ code, log: outText }))
  })
}

async function createWindow() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Vanguard DB',
      message: 'App bundle missing (dist/index.html). Run `npm run build` before packaging.',
    })
    app.quit()
    return
  }
  const server = createServer()
  // Stable port keeps one origin (localStorage, etc.); ephemeral fallback.
  const http = await (async () => {
    for (const port of [31273, 0]) {
      try {
        return await new Promise((resolve, reject) => {
          const s = server.listen(port, '127.0.0.1', () => resolve(s))
          s.on('error', reject)
        })
      } catch { /* port taken — try next */ }
    }
    throw new Error('Could not bind a port.')
  })()
  const port = http.address().port
  console.log(`Vanguard DB serving on http://127.0.0.1:${port}/`)

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    title: 'Vanguard DB',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, 'preload.mjs'),
      contextIsolation: true,
    },
  })
  mainWindow.loadURL(`http://127.0.0.1:${port}/`)
  mainWindow.on('closed', () => { mainWindow = null })
}

ipcMain.handle('vg:getState', () => ({ cardDbDir }))
ipcMain.handle('vg:exportPdf', async (e, { title }) => doExportPdf(title, e.sender))
ipcMain.handle('vg:pickFolder', async () => doPickFolder())
ipcMain.handle('vg:rescan', async () => doRescan())

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
