import { useState } from 'react'

export const CARD_BACK = '/card-images/VanguardBack.png'

/** Image with card-back fallback: broken/missing art degrades to the card back,
    and if even that is absent, to a neutral placeholder (never a broken icon). */
export default function CardImg({ src, alt, className, title, onClick, onDoubleClick, loading }: {
  src: string
  alt: string
  className?: string
  title?: string
  onClick?: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  loading?: 'lazy' | 'eager'
}) {
  const [stage, setStage] = useState(0)
  const [fullLoaded, setFullLoaded] = useState(false)

  if (stage === 2) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 text-slate-500 text-center p-2 ${className ?? ''}`} title={title ?? alt} onClick={onClick}>
        <span className="text-2xl">⚔</span>
      </div>
    )
  }

  const shown = stage === 1 ? CARD_BACK : src || CARD_BACK
  return (
    <div className={`relative ${className ?? ''}`}>
      {!fullLoaded && stage === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-500">
          <span className="text-2xl">⚔</span>
        </div>
      )}
      <img
        src={shown}
        alt={alt}
        loading={loading ?? 'lazy'}
        onLoad={() => setFullLoaded(true)}
        onError={() => setStage((s) => Math.min(2, s + 1))}
        className={`relative w-full object-contain transition-opacity duration-150 ${!fullLoaded && stage === 0 ? 'opacity-0' : 'opacity-100'}`}
        title={title}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      />
    </div>
  )
}