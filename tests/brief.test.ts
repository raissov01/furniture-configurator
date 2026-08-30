/**
 * Чат-боттың шығысы (B фаза). Модельдің жауабы желіге шықпай тексеріледі:
 * `briefToCabinet` таза функция, сондықтан «жарамсыз брифті өткізіп жіберді»
 * деген жағдай тестпен ұсталады.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  briefToCabinet,
  CabinetBriefSchema,
  generateCabinet,
} from '../src/core/index'
import type { CabinetBrief } from '../src/core/index'

const base: CabinetBrief = {
  name: 'Шкаф в прихожую',
  rationale: 'Три равные секции под верхнюю одежду и обувь.',
  height: 2200,
  width: 1800,
  depth: 450,
  construction: 'sidesOverlay',
  back: 'overlay',
  carcassMaterialId: 'ldsp16-h1145',
  frontMaterialId: 'ldsp16-h1145',
  backMaterialId: 'hdf3-white',
  sections: [
    { widthMode: 'flex', width: null, shelfCount: 4, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' },
    { widthMode: 'flex', width: null, shelfCount: 4, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' },
    { widthMode: 'flex', width: null, shelfCount: 4, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' },
  ],
}

const withBrief = (patch: Partial<CabinetBrief>): CabinetBrief => ({ ...base, ...patch })

describe('бриф → конфиг', () => {
  it('дұрыс бриф жиналатын корпус береді', () => {
    const cabinet = briefToCabinet(base, SEED_CATALOG)
    const panels = generateCabinet(cabinet, SEED_CATALOG)
    expect(panels.length).toBeGreaterThan(0)
    expect(cabinet.sections).toHaveLength(3)
    expect(panels.filter((p) => p.role === 'divider')).toHaveLength(2)
  })

  it('кромка жиынтығы корпус материалынан алынады, модельден емес', () => {
    const cabinet = briefToCabinet(base, SEED_CATALOG)
    const carcass = SEED_CATALOG.materials.find((m) => m.id === base.carcassMaterialId)!
    expect(cabinet.edging).toEqual(carcass.defaultEdging)
  })

  it('сөресіз секция empty болады, фасадсыз секция null болады', () => {
    const cabinet = briefToCabinet(
      withBrief({
        sections: [
          { widthMode: 'flex', width: null, shelfCount: 0, shelfKind: 'adjustable', drawerCount: 0, frontCount: 0, frontMount: 'overlay' },
        ],
      }),
      SEED_CATALOG,
    )
    expect(cabinet.sections[0]!.contents[0]).toEqual({ kind: 'empty' })
    expect(cabinet.sections[0]!.fronts).toBeNull()
    expect(() => generateCabinet(cabinet, SEED_CATALOG)).not.toThrow()
  })

  it('flex секцияда width өрісі МҮЛДЕ болмайды', () => {
    const cabinet = briefToCabinet(base, SEED_CATALOG)
    expect('width' in cabinet.sections[0]!).toBe(false)
  })

  it('fixed секцияда ен міндетті', () => {
    expect(() =>
      briefToCabinet(
        withBrief({
          sections: [
            { widthMode: 'fixed', width: null, shelfCount: 1, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' },
          ],
        }),
        SEED_CATALOG,
      ),
    ).toThrow(/sections\[0\]\.width/)
  })

  it('fixed секцияның ені конфигке жетеді', () => {
    const cabinet = briefToCabinet(
      withBrief({
        width: 1200,
        sections: [
          { widthMode: 'fixed', width: 500, shelfCount: 2, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' },
          { widthMode: 'flex', width: null, shelfCount: 2, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' },
        ],
      }),
      SEED_CATALOG,
    )
    expect(cabinet.sections[0]).toMatchObject({ widthMode: 'fixed', width: 500 })
  })

  it.each([
    ['height', { height: 12 }, /height/],
    ['depth', { depth: 9000 }, /depth/],
    ['бүтін емес', { width: 600.5 }, /width/],
  ])('габарит шектен шықса қате береді: %s', (_label, patch, re) => {
    expect(() => briefToCabinet(withBrief(patch as Partial<CabinetBrief>), SEED_CATALOG)).toThrow(re)
  })

  it('ойдан шығарылған материалға түсінікті қате береді', () => {
    expect(() => briefToCabinet(withBrief({ carcassMaterialId: 'ЛДСП-мрамор' }), SEED_CATALOG))
      .toThrow(/carcassMaterialId/)
  })

  it('секция саны 12-ден асса қате береді', () => {
    const many = Array.from({ length: 13 }, () => base.sections[0]!)
    expect(() => briefToCabinet(withBrief({ sections: many }), SEED_CATALOG)).toThrow(/sections/)
  })

  it('секция мүлде болмаса қате береді', () => {
    expect(() => briefToCabinet(withBrief({ sections: [] }), SEED_CATALOG)).toThrow(/sections/)
  })

  it('сөре саны 20-дан асса қате береді', () => {
    expect(() =>
      briefToCabinet(
        withBrief({
          sections: [{ widthMode: 'flex', width: null, shelfCount: 40, shelfKind: 'adjustable', drawerCount: 0, frontCount: 1, frontMount: 'overlay' }],
        }),
        SEED_CATALOG,
      ),
    ).toThrow(/shelfCount/)
  })

  it('zod схемасы толық емес жауапты өткізбейді', () => {
    const partial = { name: 'Шкаф', height: 2000 }
    expect(CabinetBriefSchema.safeParse(partial).success).toBe(false)
    expect(CabinetBriefSchema.safeParse(base).success).toBe(true)
  })
})

describe('чат-бот ұсынған ящиктер', () => {
  it('ящиктер секцияның АСТЫНА, сөрелер үстіне түседі', () => {
    const cabinet = briefToCabinet(
      withBrief({
        height: 850, width: 800, depth: 450,
        sections: [{
          widthMode: 'flex', width: null,
          shelfCount: 1, shelfKind: 'adjustable', drawerCount: 3,
          frontCount: 0, frontMount: 'overlay',
        }],
      }),
      SEED_CATALOG,
    )
    expect(cabinet.sections[0]!.contents.map((c) => c.kind)).toEqual(['drawers', 'shelves'])
    expect(() => generateCabinet(cabinet, SEED_CATALOG)).not.toThrow()
  })

  it('ящик саны шектен асса қате береді', () => {
    expect(() =>
      briefToCabinet(
        withBrief({
          sections: [{
            widthMode: 'flex', width: null,
            shelfCount: 0, shelfKind: 'adjustable', drawerCount: 40,
            frontCount: 0, frontMount: 'overlay',
          }],
        }),
        SEED_CATALOG,
      ),
    ).toThrow(/drawerCount/)
  })
})
