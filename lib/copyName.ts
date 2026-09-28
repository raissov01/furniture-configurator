/** One locale-independent display suffix for copies; existing names decide the number. */
export function nextCopyName(name: string, existingNames: Iterable<string>): string {
  let base = name.trimEnd()
  while (true) {
    const suffix = base.match(/\s+\((?:копия|зеркало)(?:\s+\d+)?\)$/u)
    if (!suffix) break
    base = base.slice(0, -suffix[0].length)
  }
  const used = new Set(existingNames)
  let index = 1
  while (true) {
    const candidate = `${base} (копия${index === 1 ? '' : ` ${index}`})`
    if (!used.has(candidate)) return candidate
    index += 1
  }
}
