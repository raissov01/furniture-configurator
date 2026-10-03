/*
 * PRO100-дағы таңдау: модульді бір басу — БҮКІЛ модуль («Выбран элемент: "H1 300"»),
 * таңдалған модульді қайта басу — сол детальге кіру. Бұрын бірінші басу бірден
 * детальді (фасадты) ұстайтын — клиент «PRO100-ға ұқсамайды» деді (2026-10-03).
 */

/**
 * Басудан кейінгі таңдау.
 * @param selected қазір таңдалғаны (модуль id-і, деталь кілті не null)
 * @param key басылған детальдің кілті
 * @param cabinetId сол детальдің модулі
 * @param cabinetPanelKeys осы модульдің деталь кілттері (деталь ішінде ауысу үшін)
 */
export function classicClickSelection(selected: string | null, key: string, cabinetId: string,
  cabinetPanelKeys: readonly string[] = []): string {
  if (selected === key) return cabinetId
  if (selected === cabinetId) return key
  if (selected !== null && cabinetPanelKeys.includes(selected)) return key
  return cabinetId
}

/**
 * Қос шерту қай терезені ашады. `selectedBefore` — қос шертудің БІРІНШІ
 * басуынан бұрынғы таңдау: бірінші басу таңдауды өзгертіп үлгереді.
 */
export function classicDoubleClickTarget(selectedBefore: string | null, key: string): 'part' | 'cabinet' {
  return selectedBefore === key ? 'part' : 'cabinet'
}
