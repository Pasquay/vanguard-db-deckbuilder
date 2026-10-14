import type { ReactNode } from 'react'

/** Render skill_text with [tokens] highlighted. */
export function renderSkill(text: string, keyPrefix = ''): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((p, i) =>
    /^\[[^\]]+\]$/.test(p)
      ? <span key={`${keyPrefix}${i}`} className="skill-token">{p}</span>
      : <span key={`${keyPrefix}${i}`}>{p}</span>,
  )
}
