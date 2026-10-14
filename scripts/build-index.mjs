// Scans ../CardDB/[era]/[set]/metadata.json -> public/data/all-cards.json + meta.json
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
const CARDDB = path.resolve(ROOT, '..', 'CardDB')
const OUT_DIR = path.resolve(ROOT, 'public', 'data')

function eraOrder(name) {
  const m = name.match(/^\[(\d+)\]/)
  return m ? parseInt(m[1], 10) : 99
}
function cleanEra(name) {
  return name.replace(/^\[\d+\]\s*/, '').trim()
}
// Universal product-type names, used in sidebar / filters / sets page alike.
function setKind(code) {
  if (/^BT\d/i.test(code)) return 'Booster'
  if (/^EB\d/i.test(code)) return 'Extra Booster'
  if (/^TD\d/i.test(code)) return 'Trial Deck'
  if (/^PR/i.test(code)) return 'Promo'
  return 'Other'
}
const RARITY_W = { RRR: 6, SP: 5, RR: 4, R: 3, TD: 2, PR: 2, C: 1 }
function featuredFor(recs, n = 8) {
  const scored = recs.map((r) => ({
    r,
    score: (r.grade ?? 0) * 10 + (RARITY_W[r.rarity] ?? 0),
  }))
  scored.sort((a, b) => b.score - a.score)
  const picked = []
  const clans = new Set()
  for (const s of scored) {
    if (picked.length >= n) break
    const clan = s.r.clan ?? '?'
    if (!clans.has(clan)) { clans.add(clan); picked.push(s.r.card_number) }
  }
  for (const s of scored) {
    if (picked.length >= n) break
    if (!picked.includes(s.r.card_number)) picked.push(s.r.card_number)
  }
  return picked
}

const all = []
const eras = []

if (!fs.existsSync(CARDDB)) {
  console.error(`CardDB not found at ${CARDDB}`)
  process.exit(1)
}

for (const eraDir of fs.readdirSync(CARDDB, { withFileTypes: true })) {
  if (!eraDir.isDirectory()) continue
  const eraPath = path.join(CARDDB, eraDir.name)
  const era = cleanEra(eraDir.name)
  const order = eraOrder(eraDir.name)
  const sets = []
  for (const setDir of fs.readdirSync(eraPath, { withFileTypes: true })) {
    if (!setDir.isDirectory()) continue
    const metaPath = path.join(eraPath, setDir.name, 'metadata.json')
    if (!fs.existsSync(metaPath)) {
      console.warn(`SKIP (no metadata.json): ${setDir.name}`)
      continue
    }
    const setName = setDir.name.replace(/^\[[^\]]+\]\s*/, '').trim()
    let recs
    try {
      recs = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    } catch (e) {
      console.warn(`SKIP (bad json): ${metaPath}: ${e.message}`)
      continue
    }
    for (const r of recs) {
      const rawFile = r.file ?? null
      const rel = (sub) => rawFile
        ? `/card-images/${encodeURIComponent(eraDir.name)}/${encodeURIComponent(setDir.name)}/${sub}/${encodeURIComponent(rawFile)}`
        : null
      // Backfill: this era's Trigger Units lack trigger_type (frame icon not
      // scraped). Heal is detectable from skill text; others stay Unknown.
      let tt = r.trigger_type ?? null
      let tp = r.trigger_power ?? null
      if (r.card_type === 'Trigger Unit' && !tt) {
        // Official source: .gift reads e.g. "Critical Trigger +5000".
        const g = /^(Critical|Draw|Heal|Stand|Front|Over)\s*Trigger\s*\+?\s*(\d+)?/i.exec(r.gift ?? '')
        if (g) {
          tt = g[1].charAt(0).toUpperCase() + g[1].slice(1).toLowerCase()
          if (g[2]) tp = parseInt(g[2], 10)
        } else if (/\[heal\]/i.test(r.skill_text ?? '')) {
          tt = 'Heal'
        }
      }
      all.push({
        ...r,
        trigger_type: tt,
        trigger_power: tp,
        era,
        era_order: order,
        set_name: setName,
        set_kind: setKind(r.set_code),
        image_raw: rel('Raw'),
        image_upscaled: rel('Upscaled'),
      })
    }
    // set code = most common set_code in file
    const codes = {}
    for (const r of recs) codes[r.set_code] = (codes[r.set_code] ?? 0) + 1
    const code = Object.entries(codes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? setDir.name
    sets.push({ code, name: setName, kind: setKind(code), count: recs.length, featured: featuredFor(recs) })
  }
  sets.sort((a, b) => a.code.localeCompare(b.code))
  eras.push({ name: era, order, sets })
}

eras.sort((a, b) => a.order - b.order)
all.sort((a, b) => a.era_order - b.era_order || a.card_number.localeCompare(b.card_number))

const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort()
const meta = {
  eras,
  clans: uniq(all.map((c) => c.clan)),
  nations: uniq(all.map((c) => c.nation)),
  races: uniq(all.map((c) => c.race)),
  card_types: uniq(all.map((c) => c.card_type)),
  trigger_types: uniq(all.map((c) => c.trigger_type)),
  rarities: uniq(all.map((c) => c.rarity)),
  total: all.length,
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'all-cards.json'), JSON.stringify(all))
fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2))
console.log(`Indexed ${all.length} cards across ${eras.length} era(s) -> public/data/`)
