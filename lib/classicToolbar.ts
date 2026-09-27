/** Бір пәрмен бірнеше қатарда тұрса, тек алғашқы батырмасы көрінеді. */
export function uniqueToolbarRows<T extends { label: string }>(rows: readonly (readonly T[])[]): T[][] {
  const seen = new Set<string>()
  return rows.map((row) => row.filter((tool) => {
    if (seen.has(tool.label)) return false
    seen.add(tool.label)
    return true
  }))
}

/** The visible toolbar must not silently hide a repeated action or reuse an icon. */
export function assertUniqueToolbarRows<T extends { icon: string; label: string }>(rows: readonly (readonly T[])[]): readonly (readonly T[])[] {
  const labels = new Set<string>()
  const icons = new Set<string>()
  for (const row of rows) for (const tool of row) {
    if (labels.has(tool.label)) throw new Error(`Repeated toolbar action: ${tool.label}`)
    if (icons.has(tool.icon)) throw new Error(`Repeated toolbar icon: ${tool.icon}`)
    labels.add(tool.label)
    icons.add(tool.icon)
  }
  return rows
}

/** Соңғы шағын қатарды үшіншіге қосып, бос toolbar биіктігін жояды. */
export function compactToolbarRows<T extends { label: string }>(rows: readonly (readonly T[])[]): T[][] {
  const unique = uniqueToolbarRows(rows)
  if (unique.length < 4) return unique
  return [unique[0] ?? [], unique[1] ?? [], unique.slice(2).flat()]
}
