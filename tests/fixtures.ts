import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CabinetConfig, Catalog, ProjectFile, Section } from '../src/core/index'
import { parseProject } from '../src/core/index'

const load = (file: string): ProjectFile =>
  parseProject(JSON.parse(readFileSync(fileURLToPath(new URL(`../examples/${file}`, import.meta.url)), 'utf8')))

export const referenceProject = load('wardrobe.json')
export const threeSectionProject = load('wardrobe-3section.json')

export const catalog: Catalog = {
  materials: referenceProject.materials,
  edgeBands: referenceProject.edgeBands,
}

export const referenceWardrobe: CabinetConfig = referenceProject.cabinets[0]!
export const threeSectionWardrobe: CabinetConfig = threeSectionProject.cabinets[0]!

export function withCabinet(patch: Partial<CabinetConfig>): CabinetConfig {
  return { ...referenceWardrobe, ...patch }
}

/** Бір flex секция — эталон кабинеттің толтырылуы. */
export function oneSection(patch: Partial<Section> = {}): Section[] {
  return [{ ...referenceWardrobe.sections[0]!, ...patch }]
}

export const PVC2 = 'pvc2-h1145'
export const PVC04 = 'pvc04-h1145'
export const CARCASS_THICKNESS = 16
