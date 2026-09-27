/** Бір пәрмен бірнеше қатарда тұрса, тек алғашқы батырмасы көрінеді. */
export function uniqueToolbarRows<T extends { label: string }>(rows: readonly (readonly T[])[]): T[][] {
  const seen = new Set<string>()
  return rows.map((row) => row.filter((tool) => {
    if (seen.has(tool.label)) return false
    seen.add(tool.label)
    return true
  }))
}

/** Соңғы шағын қатарды үшіншіге қосып, бос toolbar биіктігін жояды. */
export function compactToolbarRows<T extends { label: string }>(rows: readonly (readonly T[])[]): T[][] {
  const unique = uniqueToolbarRows(rows)
  if (unique.length < 4) return unique
  return [unique[0] ?? [], unique[1] ?? [], unique.slice(2).flat()]
}
