/** Copy names are stored identically in every UI locale, including old projects. */
function baseAndSequence(name: string): { base: string; sequence: number } {
  let base = name.trimEnd()
  let sequence = 0
  while (true) {
    const match = base.match(/\s+\(копия(?:\s+(\d+))?\)$/u)
    if (!match) break
    sequence += match[1] ? Number(match[1]) : 1
    base = base.slice(0, -match[0].length)
  }
  return { base, sequence }
}

export function nextCopyName(name: string, existingNames: Iterable<string> = [], minimumSequence = 0): string {
  const source = baseAndSequence(name)
  let sequence = Math.max(source.sequence, minimumSequence - 1)
  for (const sibling of existingNames) {
    const parsed = baseAndSequence(sibling)
    if (parsed.base === source.base) sequence = Math.max(sequence, parsed.sequence)
  }
  return `${source.base} (копия ${sequence + 1})`
}
