#!/usr/bin/env tsx
/**
 * PRO100 тест-жинағын жазу:
 *   npm run pro100:kit -- [--out dist/]
 *
 * Нәтиже — `pro100-test-kit.json`. Тестер оны `pro100-bridge.exe audit
 * pro100-test-kit.json` командасына береді де, `pro100-audit.json`
 * қайтарады (`npm run pro100:audit -- <файл>`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PRO100_KIT_NAME, defaultShopProfile, pro100TestKit } from '../core/index'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const outDir = resolve(arg('out', 'dist'))
mkdirSync(outDir, { recursive: true })
const kit = pro100TestKit(defaultShopProfile())
const file = join(outDir, `${PRO100_KIT_NAME}.json`)
writeFileSync(file, `${JSON.stringify(kit, null, 2)}\n`, 'utf8')
const items = kit.scenarios.reduce((n, s) => n + s.items.length, 0)
console.log(`PRO100 тест-жинағы: ${file} (${kit.scenarios.length} сценарий, ${items} элемент)`)
