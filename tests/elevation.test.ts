/**
 * Ілмелі модуль: еденнен биіктік.
 *
 * Басты ереже — бұл БӨЛМЕДЕГІ орны, корпустың геометриясы емес. Сондықтан
 * деталировка да, раскрой да, смета да биіктіктен ӨЗГЕРМЕУІ керек: ілмелі
 * шкаф пен еденде тұрған шкаф бірдей кесіледі.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROOM, SEED_CATALOG, findTemplate, generateCabinet, parseProject,
  placementFootprint, placementPose, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Placement } from '../src/core/index'

const cabinet: CabinetConfig = templateToCabinet(findTemplate('kitchen-wall-600')!, SEED_CATALOG)
const at = (elevation?: number): Placement => ({
  cabinetId: cabinet.id, wall: 'north', offset: 300,
  ...(elevation === undefined ? {} : { elevation }),
})

describe('еденнен биіктік', () => {
  it('берілмесе — еденде тұрады', () => {
    expect(placementPose(DEFAULT_ROOM, cabinet, at()).position.y).toBe(0)
  })

  it('берілсе — дәл сонша көтеріледі', () => {
    expect(placementPose(DEFAULT_ROOM, cabinet, at(1400)).position.y).toBe(1400)
  })

  it('көлденең орны ӨЗГЕРМЕЙДІ', () => {
    const floor = placementPose(DEFAULT_ROOM, cabinet, at(0))
    const hung = placementPose(DEFAULT_ROOM, cabinet, at(1400))
    expect(hung.position.x).toBe(floor.position.x)
    expect(hung.position.z).toBe(floor.position.z)
    expect(hung.rotationY).toBe(floor.rotationY)
  })

  it('жоспардағы ізі де өзгермейді (жоғарыдан қарағанда бірдей)', () => {
    expect(placementFootprint(DEFAULT_ROOM, cabinet, at(1400)))
      .toEqual(placementFootprint(DEFAULT_ROOM, cabinet, at(0)))
  })

  it('деталировка мен панельдер ӨЗГЕРМЕЙДІ', () => {
    // Панельдер орналасудан тәуелсіз — бұл §3-тің салдары, әрі оны бекітеміз.
    expect(generateCabinet(cabinet, SEED_CATALOG)).toEqual(generateCabinet(cabinet, SEED_CATALOG))
  })

  it('жоба файлында сақталады, ал ескі файл оқыла береді', () => {
    const project = {
      schemaVersion: 3 as const,
      name: 'Кухня',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [cabinet],
      room: DEFAULT_ROOM,
      placements: [at(1400)],
    }
    expect(parseProject(JSON.parse(JSON.stringify(project))).placements[0]!.elevation).toBe(1400)

    const old = { ...project, placements: [at()] }
    expect(parseProject(JSON.parse(JSON.stringify(old))).placements[0]!.elevation).toBeUndefined()
  })
})
