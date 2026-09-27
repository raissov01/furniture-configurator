/** Бір пәрмен бірнеше қатарда тұрса, тек алғашқы батырмасы көрінеді. */
export function uniqueToolbarRows<T extends { label: string }>(rows: readonly (readonly T[])[]): T[][] {
  const seen = new Set<string>()
  return rows.map((row) => row.filter((tool) => {
    if (seen.has(tool.label)) return false
    seen.add(tool.label)
    return true
  }))
}
