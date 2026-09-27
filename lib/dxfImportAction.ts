/** Растау тек нақты жоба жазғышы барда және әлі енгізілмеген жоспарда қолжетімді. */
export function canConfirmDxfImport(wallCount: number, hasImporter: boolean, imported: boolean): boolean {
  return hasImporter && wallCount > 0 && !imported
}
