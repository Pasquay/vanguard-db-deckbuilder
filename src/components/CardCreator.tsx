import { useState } from 'react'
import { IconHammer } from './icons.tsx'

type CreatorView = 'gallery' | 'editor'

export default function CardCreator() {
  const [view, setView] = useState<CreatorView>('gallery')

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <div className="w-full">
        <h1 className="text-2xl font-bold text-slate-100 mb-4">Card Creator</h1>

        {view === 'gallery' ? (
          <Gallery onNew={() => setView('editor')} />
        ) : (
          <Editor onBack={() => setView('gallery')} />
        )}
      </div>
    </div>
  )
}

// ── Gallery ────────────────────────────────────────────────────────────────────
function Gallery({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={onNew}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-amber-400 text-white font-semibold hover:bg-amber-500"
        >
          <IconHammer className="w-4 h-4" />
          New Card
        </button>
        <div className="ml-auto text-xs text-slate-500">Your custom cards will appear here</div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 border border-dashed border-slate-700 rounded-xl text-center gap-3">
        <div className="text-4xl text-slate-700">⚔</div>
        <div className="text-slate-400 font-semibold">No custom cards yet</div>
        <div className="text-slate-500 text-sm max-w-xs">
          Click "New Card" to open the card editor and design your first custom card.
        </div>
        <button
          onClick={onNew}
          className="mt-2 flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-amber-400 text-white font-semibold hover:bg-amber-500"
        >
          <IconHammer className="w-4 h-4" />
          Create your first card
        </button>
      </div>
    </div>
  )
}

// ── Editor ─────────────────────────────────────────────────────────────────────
function Editor({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-slate-500"
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-slate-100">New Card</h2>
        <div className="ml-auto flex items-center gap-2">
          <button className="text-sm px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:border-slate-500">
            Cancel
          </button>
          <button className="text-sm px-4 py-1.5 rounded-lg bg-amber-400 text-white font-semibold hover:bg-amber-500">
            Save Card
          </button>
        </div>
      </div>

      {/* Two-column layout: form left, preview right */}
      <div className="flex gap-4 min-h-0">

        {/* Left: form */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Basic Info */}
          <section className="border border-slate-800 rounded-xl p-4 bg-slate-950/50">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Basic Info</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Card Name</label>
                <input disabled placeholder="Coming soon…" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Card Type</label>
                <select disabled className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed">
                  <option>Normal Unit</option>
                  <option>Trigger Unit</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Grade</label>
                <select disabled className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed">
                  {[0, 1, 2, 3].map((g) => <option key={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Power</label>
                <input disabled placeholder="e.g. 10000" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Critical</label>
                <input disabled placeholder="e.g. 1" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Shield</label>
                <input disabled placeholder="e.g. 5000" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Clan</label>
                <input disabled placeholder="e.g. Royal Paladin" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nation</label>
                <input disabled placeholder="e.g. United Sanctuary" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Race</label>
                <input disabled placeholder="e.g. Human" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Rarity</label>
                <select disabled className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed">
                  {['C', 'U', 'R', 'RR', 'RRR', 'SP'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Skill */}
          <section className="border border-slate-800 rounded-xl p-4 bg-slate-950/50">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Skill</div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Skill Icons</label>
                <input disabled placeholder="e.g. AUTO, ACT, CONT" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Skill Text</label>
                <textarea disabled placeholder="Coming soon…" rows={4} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed resize-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Flavor Text</label>
                <textarea disabled placeholder="Coming soon…" rows={2} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-400 cursor-not-allowed resize-none" />
              </div>
            </div>
          </section>

          {/* Art */}
          <section className="border border-slate-800 rounded-xl p-4 bg-slate-950/50">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Card Art</div>
            <div className="flex items-center justify-center h-32 border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm cursor-not-allowed">
              🖼 Art upload — coming soon
            </div>
          </section>

        </div>

        {/* Right: preview */}
        <div className="w-64 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Preview</div>
          <div className="border border-slate-800 rounded-xl bg-slate-950/50 aspect-[50/73] flex flex-col items-center justify-center gap-2 text-slate-600">
            <div className="text-4xl">⚔</div>
            <div className="text-xs text-center px-4">Card preview will render here once the layered art system is ready</div>
          </div>
          <div className="mt-3 text-xs text-slate-600 text-center">
            Layered card rendering coming soon
          </div>
        </div>

      </div>
    </div>
  )
}