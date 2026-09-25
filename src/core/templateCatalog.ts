import type { CabinetTemplate, TemplateCategory } from './templates'

export type TemplateCatalogFilter = {
  category?: TemplateCategory | undefined
  subcategory?: string | undefined
  search?: string | undefined
}

/** Таза каталог сүзгісі. Аудармашы UI-дан беріледі; ядро i18n-ды импорттамайды. */
export function filterTemplateCatalog<T extends CabinetTemplate>(
  templates: readonly T[],
  filter: TemplateCatalogFilter,
  translate: (value: string) => string = (value) => value,
): T[] {
  const words = (filter.search ?? '').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean)
  return templates.filter((template) => {
    if (filter.category && template.category !== filter.category) return false
    if (filter.subcategory && template.subcategory !== filter.subcategory) return false
    const fields = [template.name, template.description, template.subcategory ?? '', ...(template.sourceNames ?? [])]
    const haystack = fields.flatMap((value) => [value, translate(value)]).join(' ').toLocaleLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
