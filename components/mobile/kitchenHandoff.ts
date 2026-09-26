import { toKitchenInput, type MeasurementSurvey } from '@/src/core/measure'
import { useConfigurator } from '@/store/configurator'
import type { KitchenOptions, ProjectFileV4, Room } from '@/src/core/index'

export type KitchenHandoffTarget = {
  loadKitchen(options: KitchenOptions, measuredRoom: Room): void
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
    exportProject: () => useConfigurator.getState().exportProject(),
    saveLocally: () => useConfigurator.getState().saveProjectLocally(),
    putProject,
  }
}

export async function handoffMeasurementToKitchen(survey: MeasurementSurvey, target: KitchenHandoffTarget): Promise<void> {
  const input = toKitchenInput(survey, ['north'])
  target.loadKitchen(input.options, input.room)
  // Жазылмаса, конфигуратор ескі автосақтауды ашып, өлшенген ас үй жоғалады.
  const saveError = target.saveLocally()
  if (saveError) throw new Error(saveError)
  await target.putProject(survey.id, target.exportProject())
}
