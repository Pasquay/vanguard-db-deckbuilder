// Uniform stroke icons (Lucide-style, hand-drawn) so buttons look consistent
// across platforms — no emoji, no external assets.
import type { ReactNode } from 'react'

function I({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'w-5 h-5 shrink-0'}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconGrid = ({ className }: { className?: string }) => (
  <I className={className}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </I>
)

export const IconLayers = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </I>
)

export const IconLibrary = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="m16 6 4 14" />
    <path d="M12 6v14" />
    <path d="M8 8v12" />
    <path d="M4 4v16" />
  </I>
)

export const IconPackage = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
    <path d="M12 22V12" />
    <path d="m3.3 7 8.7 5 8.7-5" />
  </I>
)

export const IconSun = ({ className }: { className?: string }) => (
  <I className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.9 4.9 1.4 1.4" />
    <path d="m17.7 17.7 1.4 1.4" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.3 17.7-1.4 1.4" />
    <path d="m19.1 4.9-1.4 1.4" />
  </I>
)

export const IconMoon = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </I>
)

export const IconSwords = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="M4 4l11.5 11.5" />
    <path d="M20 4 8.5 15.5" />
    <path d="M4 4v3h3" />
    <path d="M20 4v3h-3" />
    <path d="m14 15-1.5 5" />
    <path d="m10 15 1.5 5" />
  </I>
)

export const IconPlus = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </I>
)

export const IconPrinter = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </I>
)

export const IconChevronDown = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-3.5 h-3.5 shrink-0'}>
    <path d="m6 9 6 6 6-6" />
  </I>
)

export const IconChevronRight = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-3.5 h-3.5 shrink-0'}>
    <path d="m9 18 6-6-6-6" />
  </I>
)

export const IconChevronsLeft = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-4 h-4 shrink-0'}>
    <path d="m11 17-5-5 5-5" />
    <path d="m18 17-5-5 5-5" />
  </I>
)

export const IconChevronsRight = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-4 h-4 shrink-0'}>
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </I>
)

export const IconSliders = ({ className }: { className?: string }) => (
  <I className={className}>
    <path d="M21 4h-7" />
    <path d="M10 4H3" />
    <path d="M21 12h-9" />
    <path d="M8 12H3" />
    <path d="M21 20h-5" />
    <path d="M12 20H3" />
    <path d="M14 2v4" />
    <path d="M8 10v4" />
    <path d="M16 18v4" />
  </I>
)

export const IconCopy = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-4 h-4 shrink-0'}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </I>
)

export const IconTrash = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-4 h-4 shrink-0'}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </I>
)

export const IconRefreshCw = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-4 h-4 shrink-0'}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M21 12a9 9 0 1 1-9 9 9.75 9.75 0 0 1 6.74-2.74L21 16" />
  </I>
)

export const IconX = ({ className }: { className?: string }) => (
  <I className={className ?? 'w-4 h-4 shrink-0'}>
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </I>
)
