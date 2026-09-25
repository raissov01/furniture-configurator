#!/usr/bin/env tsx
/**
 * Базистен қайтқан audit файлын талдау:
 *   npm run bazis:audit -- <жоба>-bazis-audit.json [--out bazis-audit-report.md]
 *
 * Тестер Базисте скриптті іске қосып, `*-bazis-audit.json` жібереді. Бұл
 * команда оны скрипттің ішіндегі күтілген деректермен қайта салыстырып,
 * қазақша есеп жазады (мәселе түрі бойынша, ықтимал себебімен).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import { analyzeBasisAudit, basisAuditMarkdown, parseBasisAudit } from '../core/index'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

function main(): number {
  const file = process.argv[2]
  if (!file || file.startsWith('--')) {
    console.error('Қолдану: npm run bazis:audit -- <жоба>-bazis-audit.json [--out bazis-audit-report.md]')
    return 2
  }
  let raw: unknown
  try {
    // Базис файлды BOM-мен жазуы мүмкін.
    raw = JSON.parse(readFileSync(resolve(file), 'utf8').replace(/^﻿/, ''))
  } catch (err) {
    console.error(`JSON оқылмады — ${file}: ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }
  let audit
  try {
    audit = parseBasisAudit(raw)
  } catch (err) {
    if (err instanceof ZodError) {
      console.error(`Бұл audit файлы емес не нұсқасы басқа — ${file}:`)
      for (const issue of err.issues.slice(0, 10)) console.error(`  ${issue.path.join('.') || '(түбір)'}: ${issue.message}`)
      return 1
    }
    throw err
  }
  const report = analyzeBasisAudit(audit)
  const md = basisAuditMarkdown(report)
  const out = resolve(arg('out', 'bazis-audit-report.md'))
  writeFileSync(out, md)
  const c = report.counts
  console.log(`${report.project}: сәйкес ${c.ok}, айырма ${c.mismatch}, жоқ ${c.missing}, артық ${c.extra}, жіберілмеген ${c.notSent}`)
  const environmentProblem = report.problems.some((problem) => problem.category === 'environment')
  if (environmentProblem) console.log('Тесік/API ортасы тексерілмеді — audit толық емес; есептегі себептерді қараңыз.')
  console.log(`Есеп: ${out}`)
  return c.mismatch + c.missing + c.extra > 0 || environmentProblem ? 3 : 0
}

process.exitCode = main()
