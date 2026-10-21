// Scans ../CardDB/[era]/[set]/metadata.json -> public/data/all-cards.json + meta.json
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..')
// CLI overrides (used by the packaged app): --root <CardDB dir> --out <data dir>
const argv = process.argv.slice(2)
const argVal = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const CARDDB = argVal('--root', path.resolve(ROOT, '..', 'CardDB'))
const OUT_DIR = argVal('--out', path.resolve(ROOT, 'public', 'data'))

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
// Match "SET_NUMBEREN - name.ext" (any image extension, e.g. .webp swaps).
function rawKey(fname) {
  const m = /^([A-Z0-9]+)_([0-9A-Z]+)EN\s*-.*\.(png|jpg|jpeg|webp)$/i.exec(fname)
  return m ? { set: m[1].toUpperCase(), num: m[2].toUpperCase() } : null
}
function listFiles(dir) {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}
// Resolve the real on-disk image for a record:
//  1. exact metadata filename, 2. same set+number in any extension,
//  3. (Upscaled only) bare-number file like 7.png (pre-rename_upscaled).
function buildImageMaps(rawFiles, upFiles) {
  const rawByKey = new Map()
  for (const f of rawFiles) {
    const k = rawKey(f)
    if (k) rawByKey.set(`${k.set}_${k.num}`, f)
  }
  const upByKey = new Map()
  const upNumMap = new Map()
  for (const f of upFiles) {
    const k = rawKey(f)
    if (k) {
      upByKey.set(`${k.set}_${k.num}`, f)
      continue
    }
    const m = /^(\d+)\.(png|jpg|jpeg|webp)$/i.exec(f)
    if (m) {
      const ni = parseInt(m[1], 10)
      if (!upNumMap.has(ni)) upNumMap.set(ni, f)
    }
  }
  return { rawByKey, upByKey, upNumMap }
}
function numFromCardNumber(cardNumber) {
  const m = /^([A-Z0-9]+)\/([0-9A-Z]+)/i.exec(cardNumber ?? '')
  if (!m) return null
  return { set: m[1].toUpperCase(), num: m[2].toUpperCase().replace(/EN$/, '') }
}
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
  // Only [NN] Name folders are eras — stray folders (Scripts, loose files,
  // image dumps) must not become phantom eras in filters.
  if (!/^\[\d+\]/.test(eraDir.name)) {
    console.warn(`SKIP (not an era folder): ${eraDir.name}`)
    continue
  }
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
    // Real on-disk images (tolerates .webp swaps + unrenamed upscaled numbers).
    const rawFiles = listFiles(path.join(eraPath, setDir.name, 'Raw'))
    const upFiles = listFiles(path.join(eraPath, setDir.name, 'Upscaled'))
    const { rawByKey, upByKey, upNumMap } = buildImageMaps(rawFiles, upFiles)
    for (const r of recs) {
      const imgBase = `/card-images/${encodeURIComponent(eraDir.name)}/${encodeURIComponent(setDir.name)}`
      const key = numFromCardNumber(r.card_number)
      const lookup = key ? `${key.set}_${key.num}` : null
      // Raw: exact file, else same set+number in any extension.
      let rawFile = r.file && rawFiles.includes(r.file) ? r.file : null
      if (!rawFile && lookup) rawFile = rawByKey.get(lookup) ?? null
      // Upscaled: exact file, else same set+number, else bare number (7.png).
      let upFile = r.file && upFiles.includes(r.file) ? r.file : null
      if (!upFile && lookup) upFile = upByKey.get(lookup) ?? null
      if (!upFile && key && !Number.isNaN(parseInt(key.num, 10))) {
        upFile = upNumMap.get(parseInt(key.num, 10)) ?? null
      }
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
        image_raw: rawFile ? `${imgBase}/Raw/${encodeURIComponent(rawFile)}` : null,
        image_upscaled: upFile ? `${imgBase}/Upscaled/${encodeURIComponent(upFile)}` : null,
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
  rarities: (() => {
    const order = ['TD', 'C', 'R', 'RR', 'RRR', 'SP', 'PR']
    const found = new Set(all.map((c) => c.rarity).filter(Boolean))
    return order.filter((r) => found.has(r))
  })(),
  total: all.length,
}

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'all-cards.json'), JSON.stringify(all))
fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2))
console.log(`Indexed ${all.length} cards across ${eras.length} era(s) -> public/data/`)
