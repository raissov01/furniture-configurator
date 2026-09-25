#!/usr/bin/env node
/** Қайта өндіру: npm run import:nomenclature [-- --from docs/pro100/nomenclature.json]. */
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { importNomenclature, rowsFromArchivePaths } from '../src/core/nomenclature'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--from')) {
  throw new Error('Қолдану: npm run import:nomenclature -- --from <nomenclature.json>')
}
const source = args[1] ?? `${root}docs/pro100/nomenclature.json`
const rowSchema = z.strictObject({
  raw: z.string().min(1), category: z.string(), kind: z.enum(['base', 'wall', 'tall', 'other']),
  doors: z.number().int().nonnegative(), drawers: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(), special: z.string().nullable(),
  count: z.number().int().positive(),
})
const rows = /\.rar$/iu.test(source)
  ? rowsFromArchivePaths(execFileSync('unrar', ['lb', source], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/u))
  : z.array(rowSchema).parse(JSON.parse(readFileSync(source, 'utf8')))
const result = importNomenclature(rows)
const summary = {
  inputNames: rows.length, inputFiles: rows.reduce((sum, row) => sum + row.count, 0),
  matchedTemplates: result.matched.length,
  matchedNames: rows.length - result.unmatched.length,
  matchedFiles: result.matched.reduce((sum, item) => sum + item.sourceCount, 0),
  unmatchedNames: result.unmatched.length,
  unmatchedFiles: result.unmatched.reduce((sum, row) => sum + row.count, 0),
}
writeFileSync(`${root}src/core/data/generated/standardNomenclature.json`, `${JSON.stringify(result.matched, null, 2)}\n`)
writeFileSync(`${root}docs/pro100/nomenclature-import-report.json`, `${JSON.stringify({ summary, unmatched: result.unmatched }, null, 2)}\n`)
console.log(JSON.stringify(summary))
