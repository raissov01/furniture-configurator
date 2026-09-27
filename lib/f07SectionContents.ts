import type { SectionContent } from '../src/core/index'

const order: SectionContent['kind'][] = ['appliance', 'drawers', 'shelves', 'stand', 'filling', 'rod', 'empty']

/** Change one band of a kind. Other bands, including a second appliance, keep their identity and order. */
export function replaceSectionContent(
  contents: readonly SectionContent[], kind: SectionContent['kind'], replacement: SectionContent | null,
): SectionContent[] {
  const current = contents.filter((content) => content.kind !== 'empty')
  const index = current.findIndex((content) => content.kind === kind)
  if (index >= 0) {
    if (replacement) return current.map((content, i) => i === index ? replacement : content)
    const result = current.filter((_, i) => i !== index)
    return result.length ? result : [{ kind: 'empty' }]
  }
  if (!replacement) return current.length ? current : [{ kind: 'empty' }]
  const rank = order.indexOf(kind)
  const insertAt = current.findIndex((content) => order.indexOf(content.kind) > rank)
  if (insertAt < 0) return [...current, replacement]
  return [...current.slice(0, insertAt), replacement, ...current.slice(insertAt)]
}

/** Update a specific appliance band without replacing its neighbours. */
export function updateSectionContentAt(
  contents: readonly SectionContent[], index: number, replacement: SectionContent,
): SectionContent[] {
  if (index < 0 || index >= contents.length || contents[index]?.kind !== replacement.kind) return [...contents]
  return contents.map((content, i) => i === index ? replacement : content)
}

export function removeSectionContentAt(contents: readonly SectionContent[], index: number): SectionContent[] {
  if (index < 0 || index >= contents.length) return [...contents]
  const result = contents.filter((_, i) => i !== index)
  return result.length ? result : [{ kind: 'empty' }]
}
