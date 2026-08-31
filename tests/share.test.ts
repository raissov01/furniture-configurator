/**
 * Клиентке жіберілетін сілтеме.
 *
 * Екі талап: жоба ДӘЛ сол күйінде қайта оқылуы керек, ал бүлінген сілтеме
 * ТҮСІНІКТІ қате беруі керек — клиент «бет ашылмады» дегеннен басқа ештеңе
 * көрмесе, цехқа қоңырау шалады.
 */
import { describe, expect, it } from 'vitest'
import {
  SHARE_LINK_WARN_LENGTH,
  catalogOf,
  decodeProject,
  defaultShopProfile,
  encodeProject,
  findTemplate,
  shareLink,
  templateToCabinet,
} from '../src/core/index'
import type { ProjectFile } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)

const project = (): ProjectFile => ({
  schemaVersion: 3,
  name: 'Кухня Мурата',
  materials: catalog.materials,
  edgeBands: catalog.edgeBands,
  cabinets: [
    templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog),
    { ...templateToCabinet(findTemplate('wardrobe-3sec-1800')!, catalog), id: 'c2' },
  ],
  room: { width: 4000, depth: 3000, height: 2700 },
  placements: [{ cabinetId: 'c2', wall: 'south', offset: 300 }],
})

describe('айналып өту', () => {
  it('жоба ДӘЛ сол күйінде қайтады', () => {
    const before = project()
    const after = decodeProject(encodeProject(before))
    expect(after).toEqual(before)
  })

  it('бөлме мен орналастыру да сақталады', () => {
    const after = decodeProject(encodeProject(project()))
    expect(after.room.width).toBe(4000)
    expect(after.placements).toHaveLength(1)
    expect(after.placements[0]!.offset).toBe(300)
  })

  it('нәтиже URL-ге қауіпсіз таңбалардан ғана тұрады', () => {
    const token = encodeProject(project())
    // `+`, `/`, `=` болса, сілтеме қашып жазылады да, екі есе ұзарады.
    expect(token.slice(3)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('қысу шынымен қысқартады', () => {
    const raw = JSON.stringify(project()).length
    expect(encodeProject(project()).length).toBeLessThan(raw / 2)
  })

  it('екі рет кодтау бірдей нәтиже береді', () => {
    expect(encodeProject(project())).toBe(encodeProject(project()))
  })
})

describe('бүлінген сілтеме', () => {
  it('бөгде пішім — түсінікті қате', () => {
    expect(() => decodeProject('v9.abc')).toThrow(/формат/)
  })

  it('жарамсыз таңба — түсінікті қате', () => {
    expect(() => decodeProject('v1.!!!')).toThrow(/повреждена/)
  })

  it('қиылған сілтеме — түсінікті қате', () => {
    const token = encodeProject(project())
    expect(() => decodeProject(token.slice(0, token.length - 20))).toThrow(/повреждена|прочитать/)
  })

  it('бос кіріс — түсінікті қате', () => {
    expect(() => decodeProject('')).toThrow(/формат/)
  })

  it('пішіні дұрыс емес жоба ҚАБЫЛДАНБАЙДЫ', () => {
    // Сілтемемен кез келген нәрсе келуі мүмкін — оны ядро тексереді.
    const bad = encodeProject({ ...project(), cabinets: [] } as unknown as ProjectFile)
    expect(() => decodeProject(bad)).toThrow()
  })
})

describe('сілтеменің өзі', () => {
  it('/view#... болып құрылады', () => {
    const link = shareLink('https://example.kz', project())
    expect(link.startsWith('https://example.kz/view#v1.')).toBe(true)
  })

  it('соңындағы қиғаш сызық қосарланбайды', () => {
    expect(shareLink('https://example.kz/', project())).toContain('example.kz/view#')
  })

  it('жоба ХЕШТЕ жүреді — серверге жіберілмейді', () => {
    // Бұл жай пішім емес, ҚҰПИЯЛЫҚ шешімі: цехтың бағасы журналға түспейді.
    const link = shareLink('https://example.kz', project())
    const [path, hash] = link.split('#')
    expect(path).toBe('https://example.kz/view')
    expect(hash!.length).toBeGreaterThan(100)
  })

  it('нақты жобаның сілтемесі мессенджерге сыяды', () => {
    expect(shareLink('https://example.kz', project()).length).toBeLessThan(SHARE_LINK_WARN_LENGTH)
  })
})
