/**
 * Жиынтықтар: бұрыштық шкаф пен кухня гарнитуры.
 *
 * Бұрыш ЖАҢА геометрия емес: цехта «Г-тәрізді» деталь парақтан кесілмейді,
 * бұрышқа екі тік бұрышты корпус қойылады. Сондықтан жиынтық — дайын
 * шаблондардың орналасқан тізімі, ал тексерілетін нәрсе: олар бір-бірімен
 * қабаттаспай, бөлмеге сыюы керек.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG,
  SEED_SETS,
  findSet,
  findTemplate,
  generateCabinet,
  setToProject,
  validatePlacements,
} from '../src/core/index'

describe('жиынтықтар', () => {
  it.each(SEED_SETS.map((s) => [s.id, s] as const))('%s: корпустары жиналады', (_id, preset) => {
    const { cabinets } = setToProject(preset, SEED_CATALOG)
    expect(cabinets.length).toBeGreaterThan(1)
    for (const cabinet of cabinets) {
      expect(() => generateCabinet(cabinet, SEED_CATALOG)).not.toThrow()
    }
  })

  it.each(SEED_SETS.map((s) => [s.id, s] as const))(
    '%s: өз бөлмесінде қабаттаспайды әрі сыяды',
    (_id, preset) => {
      const { cabinets, placements } = setToProject(preset, SEED_CATALOG)
      const entries = cabinets.map((cabinet) => ({
        cabinet,
        placement: placements.find((p) => p.cabinetId === cabinet.id)!,
      }))
      expect(validatePlacements(preset.room, entries)).toEqual([])
    },
  )

  it('әр корпустың id-і бірегей — бір шаблон екі рет кірсе де', () => {
    const { cabinets, placements } = setToProject(findSet('bedroom-set')!, SEED_CATALOG)
    const ids = cabinets.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(placements.map((p) => p.cabinetId)).toEqual(ids)
  })

  it('жиынтықтағы әр шаблон бар', () => {
    for (const preset of SEED_SETS) {
      for (const item of preset.items) {
        expect(findTemplate(item.templateId), `${preset.id} → ${item.templateId}`).toBeDefined()
      }
    }
  })

  it('белгісіз шаблонға түсінікті қате', () => {
    expect(() =>
      setToProject(
        { ...findSet('corner-wardrobe')!, items: [{ templateId: 'нет-такого', wall: 'south', offset: 0 }] },
        SEED_CATALOG,
      ),
    ).toThrow(/шаблон табылмады/)
  })

  it('бұрыштық жиынтық ЕКІ БАСҚА қабырғада тұрады', () => {
    const { placements } = setToProject(findSet('corner-wardrobe')!, SEED_CATALOG)
    expect(new Set(placements.map((p) => p.wall)).size).toBe(2)
  })
})
