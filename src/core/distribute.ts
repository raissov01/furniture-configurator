/**
 * Бүтін миллиметрді бөлу. Барлық өлшем бүтін болуы керек, ал бөлу әрдайым
 * тегіс шықпайды — қалдықты ҚАЙДА салатынымыз детерминирленген болуы шарт,
 * әйтпесе бір конфиг екі рет әртүрлі деталировка береді.
 */

/**
 * `total`-ды `count` бөлікке бөледі. Әр бөлік floor(total/count),
 * қалған миллиметрлер `order` көрсеткен ретпен бір-бірлеп таратылады.
 *
 * @param order бөліктердің индекстері — қалдық қай ретпен қосылатыны
 */
export function distributeMillimetres(
  total: number,
  count: number,
  order?: number[],
): number[] {
  if (count <= 0) return []
  const base = Math.floor(total / count)
  const parts = new Array<number>(count).fill(base)
  let remainder = total - base * count
  const sequence = order ?? parts.map((_, i) => i)
  let i = 0
  while (remainder > 0) {
    const idx = sequence[i % sequence.length]
    if (idx === undefined) break
    parts[idx] = (parts[idx] ?? 0) + 1
    remainder -= 1
    i += 1
  }
  return parts
}

/**
 * Фасад саңылауларының реті: алдымен СЫРТҚЫ екеуі, содан кейін ортадағылар
 * солдан оңға (CLAUDE.md §4.7). Фасадтар әрқашан БІРДЕЙ болуы керек —
 * бірдей деталь цехта бір операцияда кесіледі.
 */
export function gapFillOrder(gapCount: number): number[] {
  if (gapCount <= 0) return []
  if (gapCount === 1) return [0]
  const middles: number[] = []
  for (let i = 1; i < gapCount - 1; i += 1) middles.push(i)
  return [0, gapCount - 1, ...middles]
}
