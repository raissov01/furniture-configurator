/**
 * Қосымша зерттеу (`input/lite`) мен өндірістік өз каталогын салыстырып,
 * тек бір мәнді Базис → own материал ID картасын жасайды.
 *
 * NODE_OPTIONS=--max-old-space-size=2048 npx tsx scripts/buildOwnMaterials.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BASIS_MATERIALS } from '../src/core/data/basisCatalog'
import { ownCatalogBuild } from '../src/core/data/catalog/index'
import { buildLegacyMaterialAliases, parseSupplementalCatalog, validateSupplementalCatalog } from '../src/core/data/catalog/materials'

const dir = fileURLToPath(new URL('../src/core/data/catalog/', import.meta.url))
const read = (name: string): unknown => JSON.parse(readFileSync(`${dir}input/lite/${name}`, 'utf8')) as unknown
const { boards, edges } = parseSupplementalCatalog(read('materials.json'), read('edges.json'))
const issues = validateSupplementalCatalog(boards, edges)
if (issues.length) throw new Error(issues.map((x) => `${x.path}: ${x.message}`).join('\n'))

const built = ownCatalogBuild()
const aliases = buildLegacyMaterialAliases(boards, BASIS_MATERIALS, built.materials, built.materialMeta)
writeFileSync(`${dir}generated/legacyMaterialAliases.json`, `${JSON.stringify(aliases, null, 2)}\n`)
console.log(`қосымша плита: ${boards.length}; кромка: ${edges.length}; бірмәнді ескі id: ${Object.keys(aliases).length}`)
