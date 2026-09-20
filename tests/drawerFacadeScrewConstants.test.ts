/**
 * Аудит Y4 (docs/audit/drilling-2026-09-20.md): `drawerFacadeScrews`-тегі
 * қабырға биіктігінің 1/3 мен 2/3-і (`wallHeight / 3`, `(wallHeight * 2) / 3`)
 * тікелей кодта жазылған. CLAUDE.md §4.9 талабы: «Every one of these is a
 * named constant in constants.ts» — шебер бір жерден өзгерте алуы керек.
 *
 * constants.ts-тегі комментарийдің өз мысалы (qdesign CNC экспорты,
 * 2026-09-02): 92 мм қабырғада 30,7 және 61,3 (→ дөңгелектегенде 31/61).
 * Осы тест ДӘЛ СОЛ санды бекітеді — рефакторинг (сиқырлы сан → аталған
 * тұрақты) мінезді өзгертпейтінін растайды.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, DRAWER_FACADE_SCREW_ROW_FRACTIONS, SEED_CATALOG, drawerFacadeScrews,
  findTemplate, generateCabinet, mergeSettings, templateToCabinet,
} from '../src/core/index'

describe('Y4: drawerFacadeScrews-тің тік орны аталған тұрақтыдан шығады', () => {
  it('DRAWER_FACADE_SCREW_ROW_FRACTIONS = [1/3, 2/3] (constants.ts комментарийінің мысалы)', () => {
    expect(DRAWER_FACADE_SCREW_ROW_FRACTIONS).toEqual([1 / 3, 2 / 3])
  })

  it('92 мм қабырғада қатарлар 31 және 61-де (комментарийдегі нақты мысал)', () => {
    const config = templateToCabinet(findTemplate('kitchen-base-drawers-600')!, SEED_CATALOG)
    const panels = generateCabinet(config, SEED_CATALOG)
    const wall = panels.find((p) => p.id.endsWith('-wall-front'))!
    const facade = panels.find((p) => p.id === `${wall.id.slice(0, -'-wall-front'.length)}-front`)!

    const wallClone = structuredClone(wall)
    const facadeClone = structuredClone(facade)
    wallClone.finishedLength = 92
    wallClone.drilling = []
    facadeClone.drilling = []

    const settings = mergeSettings(DEFAULT_SETTINGS, config.settings)
    const bands = new Map(SEED_CATALOG.edgeBands.map((b) => [b.id, b]))
    const ctx = { thickness: () => 16, bands, settings }
    drawerFacadeScrews(wallClone, facadeClone, ctx)

    const rows = [...new Set(wallClone.drilling.filter((d) => d.diameter === 3).map((d) => d.x))].sort(
      (a, b) => a - b,
    )
    expect(rows).toEqual([31, 61])
  })
})
