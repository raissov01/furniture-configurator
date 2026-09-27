import { renderMaterialsFromPanels, renderStagingOf } from '@/src/core/render/prompt'
import type { RenderAspect, RenderStyle } from '@/src/core/render/prompt'
import type { CabinetConfig, Catalog, Panel } from '@/src/core/types'

type Input = {
  image: string
  reference: string | null
  aspect: RenderAspect
  style: RenderStyle
  hint: string
  panels: Panel[]
  cabinets: CabinetConfig[]
  catalog: Catalog
  projectId: string
}

/** Project data is read from the same Panel[] used by the cut list. */
export function buildRenderRequest(input: Input) {
  return {
    image: input.image,
    aspect: input.aspect,
    referenceMode: input.reference ? 'cameraReference' as const : 'scene' as const,
    ...(input.reference ? { reference: input.reference } : {}),
    style: input.style,
    hint: input.hint,
    materials: renderMaterialsFromPanels(input.panels, input.catalog),
    staging: [...new Set(input.cabinets.map(renderStagingOf))],
    projectId: input.projectId,
  }
}

export type Crop = { x: number; y: number; width: number; height: number }

/** Crop provider dimensions before showing or downloading the selected frame. */
export async function cropRenderDataUrl(dataUrl: string, crop: Crop): Promise<string> {
  const source = new Image()
  source.src = dataUrl
  await source.decode()
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Суретті кесуге арналған canvas ашылмады')
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvas.toDataURL('image/png')
}
