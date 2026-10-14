// File-backed deck storage shared by the packaged app (electron/main.mjs)
// and the dev server (server.mjs). Decks live as JSON files in
// <CardDB>/decks/, one per deck.
import fs from 'node:fs'
import path from 'node:path'

export function decksDir(cardDbDir) {
  return path.join(cardDbDir, 'decks')
}

export function sanitizeFile(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 120) || 'Untitled'
}

function readDeckFile(file) {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (d && typeof d.id === 'string' && d.main && typeof d.main === 'object') return d
  } catch { /* corrupt — skipped */ }
  return null
}

export function listDecks(cardDbDir) {
  const dir = decksDir(cardDbDir)
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'))
  } catch {
    return []
  }
  const out = []
  for (const f of files) {
    const d = readDeckFile(path.join(dir, f))
    if (d) out.push(d)
  }
  out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  return out
}

/** Save deck under `file`; removes any other file holding the same deck id
    (covers renames when the Vanguard/era changes). */
export function saveDeck(cardDbDir, deck, file) {
  const dir = decksDir(cardDbDir)
  fs.mkdirSync(dir, { recursive: true })
  const name = sanitizeFile(file).replace(/\.json$/i, '') + '.json'
  for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.json'))) {
    if (f === name) continue
    const d = readDeckFile(path.join(dir, f))
    if (d && d.id === deck.id) fs.unlinkSync(path.join(dir, f))
  }
  fs.writeFileSync(path.join(dir, name), JSON.stringify({ ...deck, updatedAt: Date.now() }, null, 2))
  return name
}

export function deleteDeck(cardDbDir, id) {
  const dir = decksDir(cardDbDir)
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'))
  } catch {
    return false
  }
  for (const f of files) {
    const d = readDeckFile(path.join(dir, f))
    if (d && d.id === id) {
      fs.unlinkSync(path.join(dir, f))
      return true
    }
  }
  return false
}
