#!/usr/bin/env tsx
/**
 * Өз каталогымыздың генераторы (docs/catalog/sources.md).
 *
 * Кіріс:
 *   src/core/data/catalog/input/research/*.json — өндірушілердің ашық каталогынан жиналған факт
 *   src/core/data/catalog/input/supplierPrices.json — ҚР жеткізушілерінің ашық бағалары
 *     (`.codex-runs/pricing-research/suppliers.json`-дың ЛДСП/МДФ/ХДФ/кромка жолдары)
 * Шығыс: src/core/data/catalog/generated/*.json (қолмен өзгертпе — осы скриптті қайта жүргіз):
 *   catalog.json         — тексерілген `OwnCatalogInput` (декор + кромка жазбалары, ықшам)
 *   referencePrices.json — «Анықтамалық (жеткізуші)» прайс-парағы
 *   sources.json         — дереккөздер мен алынбаған көздер (себебімен)
 *   report.json          — қамту есебі (өндіруші бойынша, олқылықтар)
 *
 * Material/EdgeBand-қа жаю жүктеу кезінде (`index.ts` → `buildOwnCatalog`) жасалады:
 * 6 мыңнан астам материалды JSON-ға жайып жазу бандлды бірнеше есе үлкейтеді.
 *
 * Тексеріс (`validateOwnCatalogInput`) бір қате тапса да — ештеңе жазылмайды,
 * әр қате жазба мен өріс атымен шығады.
 *
 *   npm run catalog:build
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildOwnCatalogBundle } from '../src/core/data/catalog/build'
import { normalizeResearch, parseResearchFile } from '../src/core/data/catalog/research'
import type { SupplierPriceRow } from '../src/core/data/catalog/referencePrices'

const DIR = fileURLToPath(new URL('../src/core/data/catalog/', import.meta.url))
const RESEARCH = `${DIR}input/research/`
const OUT = `${DIR}generated/`

const files = readdirSync(RESEARCH).filter((f) => f.endsWith('.json')).sort()
const research = files.map((f) => parseResearchFile(JSON.parse(readFileSync(RESEARCH + f, 'utf8')), f))
const supplierRows = JSON.parse(readFileSync(`${DIR}input/supplierPrices.json`, 'utf8')) as SupplierPriceRow[]

// Толық құрастыру — тексеріс қатесі болса осында лақтырады, файлдар жазылмайды.
const b = buildOwnCatalogBundle(research, supplierRows)
const { input } = normalizeResearch(research)

const write = (name: string, data: unknown) => writeFileSync(`${OUT}${name}`, `${JSON.stringify(data)}\n`)
write('catalog.json', input)
write('referencePrices.json', b.referencePrices)
write('sources.json', { sources: b.sources, skipped: b.report.skipped })
write('report.json', { ...b.report, skipped: b.report.skipped.length })

console.log(`материал: ${b.materials.length}, кромка: ${b.edgeBands.length}, анықтамалық баға: ${b.referencePrices.length}`)
for (const [m, s] of Object.entries(b.report.decorsByManufacturer)) {
  console.log(`  ${m}: декор ${s.included}/${s.found}`)
}
console.log(`  өлшемсіз декор: ${b.report.decorsWithoutSizes}, өлшемсіз кромка: ${b.report.edgesWithoutSizes}, шешілмеген кромка сәйкестігі: ${b.report.unresolvedEdgeMatches}`)
