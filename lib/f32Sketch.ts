import type { Section, SectionContent } from '@/src/core/types'

type Content = { kind: string }
type SectionView = { id: string; contents: Content[]; fronts?: object | null | undefined }

const hasContent = (content: Content) => content.kind !== 'empty'
const sectionHasContent = (section: SectionView) =>
  section.contents.some(hasContent) || Boolean(section.fronts)

/** Бір жағындағы мазмұн ғана болса, соны сақтау анық; екеуі де толы болса таңдау керек. */
export function eraseDividerDecision(left: SectionView, right: SectionView): {
  requiresConfirmation: boolean; keep: 'left' | 'right'
} {
  const leftUsed = sectionHasContent(left)
  const rightUsed = sectionHasContent(right)
  return { requiresConfirmation: leftUsed && rightUsed, keep: !leftUsed && rightUsed ? 'right' : 'left' }
}

export function eraseBandDecision(lower: Content, upper: Content): {
  requiresConfirmation: boolean; keep: 'lower' | 'upper'
} {
  const lowerUsed = hasContent(lower)
  const upperUsed = hasContent(upper)
  return { requiresConfirmation: lowerUsed && upperUsed, keep: !lowerUsed && upperUsed ? 'upper' : 'lower' }
}

export function mergeSectionsForErase(sections: Section[], index: number, keep: 'left' | 'right'): Section[] {
  const kept = sections[index + (keep === 'right' ? 1 : 0)]!
  const next = [...sections]
  next.splice(index, 2, { ...kept, widthMode: 'flex', width: undefined })
  return next
}

export function mergeBandsForErase(section: Section, index: number, keep: 'lower' | 'upper'): Section {
  const kept = section.contents[index + (keep === 'upper' ? 1 : 0)]!
  const contents = [...section.contents]
  contents.splice(index, 2, { ...kept, height: undefined })
  return { ...section, contents }
}

/** Эскиздегі 100 мм шек бұрыннан бар; үнсіз бас тартудың орнына өрісті көрсетеміз. */
export function splitDecision(
  first: number, total: number, thickness: number, field: 'divider' | 'band',
): { allowed: true; first: number; second: number; error?: never } |
  { allowed: false; error: string; first?: never; second?: never } {
  const a = Math.round(first)
  const b = Math.round(total - a - thickness)
  if (a < 100 || b < 100) return { allowed: false, error: `${field}: екі бөлік те 100 мм-ден кем болмауы керек (рұқсат 100..${total - thickness - 100} мм)` }
  return { allowed: true, first: a, second: b }
}

export function sketchContentDecision(
  current: SectionContent | undefined, tool: 'shelf' | 'drawer' | 'rod',
): { next: SectionContent; requiresConfirmation: boolean; error?: never } |
  { error: string; next?: never; requiresConfirmation?: never } {
  const height = current?.height === undefined ? {} : { height: current.height }
  if (tool === 'shelf') {
    if (current?.kind === 'shelves' && current.count >= 20) return { error: 'contents.shelves.count: рұқсат 1..20' }
    return { next: current?.kind === 'shelves'
      ? { ...current, count: current.count + 1 }
      : { kind: 'shelves', count: 1, shelfKind: 'adjustable', ...height },
      requiresConfirmation: current?.kind !== undefined && current.kind !== 'empty' && current.kind !== 'shelves' }
  }
  if (tool === 'drawer') {
    if (current?.kind === 'drawers' && current.count >= 8) return { error: 'contents.drawers.count: рұқсат 1..8' }
    return { next: current?.kind === 'drawers'
      ? { ...current, count: current.count + 1 }
      : { kind: 'drawers', count: 1, ...height },
      requiresConfirmation: current?.kind !== undefined && current.kind !== 'empty' && current.kind !== 'drawers' }
  }
  return { next: { kind: 'rod', ...height },
    requiresConfirmation: current?.kind !== undefined && current.kind !== 'empty' && current.kind !== 'rod' }
}
