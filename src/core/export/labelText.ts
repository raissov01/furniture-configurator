/** Материал атауында көрсетілген қалыңдықты жапсырмада қайталамау. */
export function labelMaterialText(name: string, thickness: number): string {
  const pattern = new RegExp(`(^|[^\\d])${thickness}\\s*мм(?=$|[^\\d])`, 'i')
  return pattern.test(name) ? name : `${name}, ${thickness} мм`
}

/** Ұяшыққа сыймайтын атауды екі жолға сөз шекарасы бойынша бөлу. */
export function fitLabelLines(value: string, maxWidth: number, width: (text: string) => number): string[] {
  if (width(value) <= maxWidth) return [value]
  const words = value.split(/\s+/)
  for (let split = words.length - 1; split > 0; split -= 1) {
    const first = words.slice(0, split).join(' ')
    const second = words.slice(split).join(' ')
    if (width(first) <= maxWidth && width(second) <= maxWidth) return [first, second]
  }
  return [value]
}
