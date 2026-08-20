import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CabinetConfig, Catalog, ProjectFile } from '../src/core/index.js'
import { ProjectFileSchema } from '../src/core/index.js'

const examplePath = fileURLToPath(new URL('../examples/wardrobe.json', import.meta.url))

export const referenceProject: ProjectFile = ProjectFileSchema.parse(
  JSON.parse(readFileSync(examplePath, 'utf8')),
)

export const catalog: Catalog = {
  materials: referenceProject.materials,
  edgeBands: referenceProject.edgeBands,
}

export const referenceWardrobe: CabinetConfig = referenceProject.cabinets[0]!

export function withCabinet(patch: Partial<CabinetConfig>): CabinetConfig {
  return { ...referenceWardrobe, ...patch }
}

export const PVC2 = 'pvc2-h1145'
export const PVC04 = 'pvc04-h1145'
export const CARCASS_THICKNESS = 16
