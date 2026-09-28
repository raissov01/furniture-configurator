/** Бұрынғы жобаларда жиналған соңғы «(зеркало)» жұрнақтарын бір санға жинайды. */
export function normalizeMirrorName(name: string): string {
  let base = name.trimEnd()
  let count = 0
  while (true) {
    const match = base.match(/\s+\(зеркало(?:\s+(\d+))?\)$/u)
    if (!match) break
    count += match[1] ? Number(match[1]) : 1
    base = base.slice(0, -match[0].length)
  }
  return count === 0 ? name : `${base} (зеркало${count === 1 ? '' : ` ${count}`})`
}

/** Келесі айнаға қысқа, алдыңғыларынан бөлек атау береді. */
export function nextMirrorName(name: string): string {
  const normalized = normalizeMirrorName(name)
  const match = normalized.match(/\s+\(зеркало(?:\s+(\d+))?\)$/u)
  const count = match ? (match[1] ? Number(match[1]) : 1) : 0
  const base = match ? normalized.slice(0, -match[0].length) : normalized
  const next = count + 1
  return `${base} (зеркало${next === 1 ? '' : ` ${next}`})`
}
