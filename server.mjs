// Local server: serves card images from ../CardDB + static dist/ build.
// Run: npm run index (once) then npm run server. Vite dev proxies here.
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

if (fs.existsSync(DIST)) app.use(express.static(DIST))

app.listen(PORT, () => console.log(`Vanguard server on http://localhost:${PORT} (CardDB: ${CARDDB})`))
