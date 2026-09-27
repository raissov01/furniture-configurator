/** ЖИ тек ниетті айтады; бұл шекара генераторға сыйымды бүтін қабырға береді. */
import { furnitureMinWallLength } from './furniture'
import type { FurnitureType } from './furniture'

export type StageBriefOptions = {
  type: FurnitureType
  layout: 'straight' | 'corner'
  lengthA: number
  lengthB: number | null
  sink: boolean
  upper: boolean
  appliances: boolean
}

export function sanitizeGeneratedOptions(o: StageBriefOptions): StageBriefOptions {
  const clamp = (n: number, minimum = 600) => Math.min(8000, Math.max(minimum, Math.round(n)))
  const layout = o.type === 'tv' || o.type === 'bedroom' ? 'straight' : o.layout
  return {
    type: o.type,
    layout,
    lengthA: clamp(o.lengthA, furnitureMinWallLength(o.type)),
    lengthB: layout === 'corner' ? clamp(o.lengthB ?? 2400) : null,
    sink: Boolean(o.sink),
    upper: Boolean(o.upper),
    appliances: Boolean(o.appliances),
  }
}
