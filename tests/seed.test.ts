/** PHASE-2 A4 — материалдар мен кромка кітапханасы. */
import { describe, expect, it } from 'vitest'
import { EdgeBandSchema, MaterialSchema, SEED_CATALOG, generateCabinet } from '../src/core/index.js'
import { referenceWardrobe } from './fixtures.js'

describe('seed кітапхана', () => {
  it('әр материал мен кромка схемадан өтеді, id-лері бірегей', () => {
    for (const m of SEED_CATALOG.materials) MaterialSchema.parse(m)
    for (const b of SEED_CATALOG.edgeBands) EdgeBandSchema.parse(b)
    expect(new Set(SEED_CATALOG.materials.map((m) => m.id)).size).toBe(SEED_CATALOG.materials.length)
    expect(new Set(SEED_CATALOG.edgeBands.map((b) => b.id)).size).toBe(SEED_CATALOG.edgeBands.length)
  })

  it('материалдың defaultEdging-і бар кромкаға сілтейді', () => {
    const bandIds = new Set(SEED_CATALOG.edgeBands.map((b) => b.id))
    for (const m of SEED_CATALOG.materials) {
      for (const id of Object.values(m.defaultEdging ?? {})) {
        if (id !== null) expect(bandIds, `${m.id} → ${id}`).toContain(id)
      }
    }
  })

  it('бір түсті декорда текстура жоқ, ағаш декорда бар', () => {
    expect(SEED_CATALOG.materials.find((m) => m.id === 'ldsp16-w980')!.hasGrain).toBe(false)
    expect(SEED_CATALOG.materials.find((m) => m.id === 'ldsp16-h1145')!.hasGrain).toBe(true)
  })

  it('seed материалдарымен кабинет жасалады', () => {
    const m = SEED_CATALOG.materials.find((x) => x.id === 'ldsp16-w980')!
    const panels = generateCabinet(
      {
        ...referenceWardrobe,
        carcassMaterialId: m.id,
        frontMaterialId: m.id,
        backMaterialId: 'hdf3-white',
        edging: m.defaultEdging!,
      },
      SEED_CATALOG,
    )
    expect(panels).toHaveLength(11)
    // Текстурасыз декор → раскройда бұруға болады
    expect(panels[0]!.grainAlongLength).toBe(false)
  })
})
