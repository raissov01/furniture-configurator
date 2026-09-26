import { toKitchenInput, type MeasurementSurvey } from '@/src/core/measure'
import { useConfigurator } from '@/store/configurator'
import type { KitchenOptions, ProjectFileV4, Room } from '@/src/core/index'
import type { WallId } from '@/src/core/types'
import type { RoomTolerance } from '@/src/core/measure'

export type KitchenHandoffTarget = {
  loadKitchen(options: KitchenOptions, measuredRoom: Room): void
  placeOnWall?(wall: WallId): void
  exportProject(): ProjectFileV4
  /** Конфигуратордың автосақтауы: /configurator ашылғанда hydrateProject() осыны оқиды. */
  saveLocally(): string | null
  putProject(surveyId: string, project: ProjectFileV4): Promise<void>
}

/** The IDB project key is the source survey ID; dimensions come from the measured room. */
/** Мобильді беттің нақты байланысы: конфигуратор дүкені + IndexedDB жазбасы. */
export function configuratorKitchenTarget(putProject: KitchenHandoffTarget['putProject']): KitchenHandoffTarget {
  return {
    loadKitchen: (options, room) => {
      // Телефон беті жобаны оқымаған: алдымен сақталғанын ашамыз — ол Ctrl+Z-те
      // қалады, ал бүлінген файл сақтық көшірмесіз басылмайды (saveLocally қате береді).
      useConfigurator.getState().hydrateProject()
      useConfigurator.getState().loadKitchen(options, room)
    },
    placeOnWall: (wall) => {
      if (wall === 'north') return
      const placements = [...useConfigurator.getState().placements]
      for (const placement of placements) useConfigurator.getState().movePlacement(placement.cabinetId, { wall })
    },
    exportProject: () => useConfigurator.getState().exportProject(),
    saveLocally: () => useConfigurator.getState().saveProjectLocally(),
    putProject,
  }
}

export async function handoffMeasurementToKitchen(survey: MeasurementSurvey, target: KitchenHandoffTarget,
  walls: readonly WallId[] = ['north'], tolerance: RoomTolerance = { wallMm: 0, cornerDeg: 0 }): Promise<void> {
  const input = toKitchenInput(survey, walls, tolerance)
  target.loadKitchen(input.options, input.room)
  if (input.options.layout === 'straight') target.placeOnWall?.(input.wallMap.runA)
  // Жазылмаса, конфигуратор ескі автосақтауды ашып, өлшенген ас үй жоғалады.
  const saveError = target.saveLocally()
  if (saveError) throw new Error(saveError)
  await target.putProject(survey.id, target.exportProject())
}
