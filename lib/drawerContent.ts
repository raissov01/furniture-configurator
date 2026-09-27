import type { SectionContent } from '@/src/core/types'

type Drawers = Extract<SectionContent, { kind: 'drawers' }>

/** Rebuilding a section must not discard its drawer hardware and gaps. */
export function drawerContentWithCount(current: Drawers | undefined, count: number): Drawers | null {
  if (count <= 0) return null
  return { ...current, kind: 'drawers', count }
}
