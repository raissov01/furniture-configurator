#!/usr/bin/env tsx
/**
 * PRO100 көпірінен қайтқан audit файлын талдау:
 *   npm run pro100:audit -- pro100-audit.json [--out pro100-audit-report.md]
 *
 * Көпірдің өз салыстыруына сенбей, шикі деректен қайта салыстырады да,
 * қазақша есеп жазады (мәселе түрі бойынша, ықтимал себебімен).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import { analyzePro100Audit, parsePro100Audit, pro100AuditMarkdown } from '../core/index'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

function main(): number {
  const file = process.argv[2]
  if (!file || file.startsWith('--')) {
    console.error('Қолдану: npm run pro100:audit -- pro100-audit.json [--out pro100-audit-report.md]')
    return 2
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(resolve(file), 'utf8').replace(/^﻿/, ''))
  } catch (err) {
    console.error(`JSON оқылмады — ${file}: ${err instanceof Error ? err.message : String(err)}`)
    return 1
  }
  let audit
  try {
    audit = parsePro100Audit(raw)
  } catch (err) {
    if (err instanceof ZodError) {
      console.error(`Бұл PRO100 audit файлы емес не нұсқасы басқа — ${file}:`)
      for (const issue of err.issues.slice(0, 10)) console.error(`  ${issue.path.join('.') || '(түбір)'}: ${issue.message}`)
      return 1
    }
    throw err
  }
  const report = analyzePro100Audit(audit)
  const out = resolve(arg('out', 'pro100-audit-report.md'))
  writeFileSync(out, pro100AuditMarkdown(report))
  const s = report.summary
  console.log(`${report.project}: сәйкес ${s.OK}, айырма ${s.MISMATCH}, жоқ ${s.MISSING}, артық ${s.EXTRA}, өткізілген ${s.SKIPPED}`)
  if (report.summaryAgrees === false) console.log('⚠ Көпірдің қорытындысы біздің қайта есебімізден өзгеше.')
  if (report.stopped) console.log(`⚠ Жүгіріс тоқтатылған: ${report.stopped.reason}`)
  console.log(`Есеп: ${out}`)
  return s.MISMATCH + s.MISSING + s.EXTRA > 0 || report.stopped ? 3 : 0
}

process.exitCode = main()
