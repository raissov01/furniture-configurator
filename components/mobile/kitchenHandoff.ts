import { toKitchenInput, type MeasurementSurvey } from '@/src/core/measure'
import type { KitchenOptions, ProjectFileV4, Room } from '@/src/core/index'

export type KitchenHandoffTarget = {
  loadKitchen(options: KitchenOptions, measuredRoom: Room): void
  exportProject(): ProjectFileV4
  putProject(surveyId: string, project: ProjectFileV4): Promise<void>
}

/** The IDB project key is the source survey ID; dimensions come from the measured room. */
export async function handoffMeasurementToKitchen(survey: MeasurementSurvey, target: KitchenHandoffTarget): Promise<void> {
  const input = toKitchenInput(survey, ['north'])
  target.loadKitchen(input.options, input.room)
  await target.putProject(survey.id, target.exportProject())
}
