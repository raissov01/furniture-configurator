import { describe, expect, it } from 'vitest'
import { cabinetImportChoice } from '@/components/panels/libraryCatalogLogic'
import { parseCabinetName } from '@/src/core/data/pro100Catalog'

describe('PRO100 нобайын жобаға ұсыну', () => {
  it('бұрыш пен анық емес енді тоқтатады', () => {
    const name = 'Угловой 780 (400)'
    expect(cabinetImportChoice({ name, path: ['Мебель', 'Кухни', 'Угловые'], parsed: parseCabinetName(name) }))
      .toEqual({ allowed: false, reason: 'unsupportedShape' })
  })

  it('тек ені белгілі жай шкафқа нақты шаблонның H/W/D алдын ала көрсетеді', () => {
    const name = 'В - 600 2Дв'
    const choice = cabinetImportChoice({ name, path: ['Мебель', 'Кухни'], parsed: parseCabinetName(name) })
    expect(choice).toMatchObject({ allowed: true, templateId: 'kitchen-wall-600', size: { width: 600 },
      dimensions: { height: 720, width: 600, depth: 300 } })
  })

  it('шаблон ауқымынан тыс енді үнсіз қыспайды', () => {
    expect(cabinetImportChoice({ name: 'В - 2900', path: ['Мебель'], parsed: parseCabinetName('В - 2900') }).allowed).toBe(false)
  })
})
