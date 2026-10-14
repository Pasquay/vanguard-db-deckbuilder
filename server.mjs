// Local server: serves card images from ../CardDB + static dist/ build.
// Run: npm run index (once) then npm run server. Vite dev proxies here.
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { deleteDeck, listDecks, saveDeck } from './electron/deckfiles.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = here
const CARDDB = path.resolve(ROOT, '..', 'CardDB')
const DIST = path.resolve(ROOT, 'dist')
const PORT = 3001

const app = express()

// /card-images/<era>/<set>/<Raw|Upscaled>/<file> -> CardDB/<era>/<set>/...
app.use('/card-images', express.static(CARDDB, {
  fallthrough: true,
  setHeaders(res, filePath) {
    if (/\.(png|jpg|jpeg|webp)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=86400')
  },
}))

app.get('/api/health', (_req, res) => res.json({ ok: true, carddb: fs.existsSync(CARDDB) }))

// Deck files (<CardDB>/decks/), same contract as the packaged app.
app.use(express.json({ limit: '4mb' }))
app.get('/api/decks', (_req, res) => res.json({ ok: true, decks: listDecks(CARDDB) }))
app.post('/api/decks', (req, res) => {
  const { deck, file } = req.body ?? {}
  if (!deck || typeof deck.id !== 'string') return res.status(400).json({ ok: false, error: 'Bad deck.' })
  try {
    res.json({ ok: true, file: saveDeck(CARDDB, deck, file ?? deck.name ?? 'Untitled') })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})
app.delete('/api/decks/:id', (req, res) => res.json({ ok: deleteDeck(CARDDB, req.params.id) }))

// Desktop-only operations (packaged app serves these for real).
app.get('/api/desktop-state', (_req, res) => res.json({ cardDbDir: null }))
app.post('/api/pick-folder', (_req, res) => res.status(501).json({ ok: false, error: 'Folder picking needs the packaged app.' }))
app.post('/api/rescan', (_req, res) => res.status(501).json({ ok: false, error: 'Rescan needs the packaged app.' }))
app.post('/api/export-pdf', (_req, res) => res.status(501).json({ ok: false, error: 'PDF export needs the packaged app.' }))

if (fs.existsSync(DIST)) app.use(express.static(DIST))

app.listen(PORT, () => console.log(`Vanguard server on http://localhost:${PORT} (CardDB: ${CARDDB})`))
