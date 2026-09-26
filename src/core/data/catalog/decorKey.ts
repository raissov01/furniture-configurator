const norm = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase()

/** Декор кілті: өндіруші + декор коды + құрылым (бос орын/регистр ескерілмейді). */
export function decorKey(manufacturer: string, decorCode: string, structureCode: string | null): string {
  return `${manufacturer.toLowerCase()}|${norm(decorCode)}|${structureCode === null ? '' : norm(structureCode)}`
}
