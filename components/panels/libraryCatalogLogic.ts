/**
 * «Библиотека» панелінің ТАЗА логикасы — React, DOM, zustand импорты ЖОҚ
 * (CLAUDE.md §3: логика таза қабатта, React тек көрсетеді). Осы файл
 * `tests/libraryCatalogLogic.test.ts`-те қорғалады.
 */
import { findTemplate } from '../../src/core/index'
import type { TemplateSize } from '../../src/core/index'
import type { ParsedCabinetInfo, Pro100LibraryItem } from '../../src/core/data/pro100Catalog'

export type LibraryTabId = 'mebel' | 'elementy' | 'raznoe' | 'materialy'

export const LIBRARY_TABS: { id: LibraryTabId; label: string }[] = [
  { id: 'mebel', label: 'Мебель' },
  { id: 'elementy', label: 'Элементы' },
  { id: 'raznoe', label: 'Разное' },
  { id: 'materialy', label: 'Материалы' },
]

// ── Іздеу/санат сүзгісі ──────────────────────────────────────────────────────

type SearchableItem = { name: string; path?: string[] }

function matchesSearch(item: SearchableItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return item.name.toLowerCase().includes(q)
}

/** `path`-ты breadcrumb жолы етіп қосу (path[0] === 'Мебель' — алынып тасталады). */
export function categoryLabel(path: string[]): string {
  return path.slice(1).join(' \\ ')
}

function matchesCategory(item: SearchableItem, categoryPath: string | null): boolean {
  if (!categoryPath) return true
  if (!item.path) return false
  const label = categoryLabel(item.path)
  return label === categoryPath || label.startsWith(`${categoryPath} \\ `)
}

export function filterItems<T extends SearchableItem>(
  items: T[],
  opts: { search: string; categoryPath: string | null },
): T[] {
  return items.filter((i) => matchesSearch(i, opts.search) && matchesCategory(i, opts.categoryPath))
}

/**
 * Бума жолдарының бірегей тізімі (breadcrumb ашылмалысы үшін) — 5094
 * жолды бірден рендерлемеу үшін тек СЕЛЕКТ опциялары, көрінетін тор емес.
 */
export function categoryOptions(items: SearchableItem[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    if (!item.path) continue
    const label = categoryLabel(item.path)
    if (label) set.add(label)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
}

// ── Беттеу (5094 жолды бірден рендерлемеу — гоча №4) ────────────────────────

export function paginate<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1)
  const start = clampedPage * pageSize
  return { pageItems: items.slice(start, start + pageSize), totalPages, page: clampedPage }
}

// ── Каталог нобайынан жобаға қосу: жақын ішкі шаблонды таңдау ───────────────

/**
 * PRO100 атауынан оқылған ені БАР, бірақ биіктік/тереңдік ЖОҚ (§ЕСЕП,
 * pro100Catalog.ts-тегі ескерту). Сондықтан «жобаға қосу» дегеніміз — дәл
 * сол PRO100 корпусы емес, БІЗДІҢ ӨЗ SEED_TEMPLATES-тегі ЕҢ ЖАҚЫН типтес
 * шаблон (позиция/мойка/ящик бойынша), ені ТЕК шаблонның қолдайтын
 * ауқымына сыйдырылып ауыстырылады. Биіктік/тереңдік — шаблонның ӨЗ
 * дефолты (жүйеде бұрыннан бар, әр PRO100 жолы үшін ойдан табылмаған).
 */
export function pickTemplateForCabinetItem(parsed: ParsedCabinetInfo): { templateId: string; size: TemplateSize } {
  const templateId = parsed.hasSink
    ? 'kitchen-sink-800'
    : parsed.position === 'upper'
      ? 'kitchen-wall-600'
      : parsed.drawerCount !== undefined
        ? 'kitchen-base-drawers-600'
        : 'kitchen-base-600'

  const template = findTemplate(templateId)
  const size: TemplateSize = {}
  if (parsed.widthMm !== undefined && template) {
    const { min, max } = template.range.width
    size.width = Math.min(Math.max(parsed.widthMm, min), max)
  }
  return { templateId, size }
}

export function isCabinetItem(item: Pro100LibraryItem): boolean {
  return item.group === 'cabinet'
}
