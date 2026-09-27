/** 0 мм ескі цехтарда 0.4 мм кромканы да шегеретін; бұл бүтін резді бұзады. */
export function migrateBandThreshold(raw: unknown): { value: unknown; warnings: string[] } {
  const warnings: string[] = []
  const visit = (input: unknown, path: string): unknown => {
    if (Array.isArray(input)) return input.map((item, index) => visit(item, `${path}[${index}]`))
    if (input === null || typeof input !== 'object') return input
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(input)) {
      const field = path ? `${path}.${key}` : key
      if (key === 'minBandSubtract' && item === 0) {
        output[key] = 1
        warnings.push(`${field}: ескі 0 мм шегі 1 мм-ге көшірілді; кесу өлшемін тексеріңіз`)
      } else {
        output[key] = visit(item, field)
      }
    }
    return output
  }
  return { value: visit(raw, ''), warnings }
}
