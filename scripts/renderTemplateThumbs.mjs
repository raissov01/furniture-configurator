/**
 * «Готовые шаблоны» галереясының 3D превьюлері (build-time).
 *
 * Әр шаблон мен жиынтық біздің ӨЗ генераторымыз бен R3F сахнамыздан
 * (`/dev/thumb` → `components/ThumbStage.tsx`) салынады, headless Chrome
 * кадрды алады да, 320×240 WebP болып `public/templates/thumbs/<id>.webp`-ке
 * жазылады. Қолмен салынған сурет жоқ (CLAUDE.md §3).
 *
 *   npx next dev -p 3240 &
 *   node scripts/renderTemplateThumbs.mjs [http://localhost:3240] [--only id1,id2]
 *
 * PLAYWRIGHT_NODE_MODULES=/path/node_modules — playwright-core қай жерде тұр.
 * CHROME=/path/to/chrome — браузердің жолы (әдепкіде playwright-core-дың өзі
 * тапқаны). WebGL GPU-сыз жұмыс істеуі үшін `--use-gl=swiftshader`.
 *
 * Шығысы: суреттер + `lib/templateThumbs.generated.ts` (id → хэш). Галерея
 * манифестте жоқ id-ге ескі SVG сызбасын көрсетеді.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

/*
 * playwright-core жобаның тәуелділігі ЕМЕС (тек осы құралға керек):
 * PLAYWRIGHT_NODE_MODULES=/…/node_modules арқылы бар орнатымды көрсетуге болады.
 */
const requireFrom = createRequire(process.env.PLAYWRIGHT_NODE_MODULES
  ? path.join(process.env.PLAYWRIGHT_NODE_MODULES, 'noop.js')
  : import.meta.url)
const { chromium } = requireFrom('playwright-core')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public/templates/thumbs')
const MANIFEST = path.join(ROOT, 'lib/templateThumbs.generated.ts')

const args = process.argv.slice(2)
const base = args.find((a) => /^https?:/.test(a)) ?? 'http://localhost:3240'
const onlyArg = args.indexOf('--only')
const only = onlyArg >= 0 ? new Set(args[onlyArg + 1].split(',')) : null

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const failures = []
const written = new Map()
try {
  const page = await browser.newPage({ viewport: { width: 700, height: 560 } })
  page.on('pageerror', (e) => console.error('pageerror:', e.message))
  await page.goto(`${base}/dev/thumb`, { waitUntil: 'networkidle', timeout: 180_000 })
  await page.waitForFunction(() => '__thumb' in window, null, { timeout: 120_000 })
  const targets = await page.evaluate(() => window.__thumb.list())
  await mkdir(OUT_DIR, { recursive: true })

  for (const [i, { kind, id }] of targets.entries()) {
    if (only && !only.has(id)) continue
    const t0 = Date.now()
    try {
      const dataUrl = await page.evaluate(([k, x]) => window.__thumb.shot(k, x), [kind, id])
      const status = await page.textContent('[data-thumb-status]')
      if (status?.startsWith('ERROR')) throw new Error(status)
      if (!dataUrl.startsWith('data:image/webp')) throw new Error('WebP емес: ' + dataUrl.slice(0, 30))
      const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
      await writeFile(path.join(OUT_DIR, `${id}.webp`), buf)
      written.set(id, createHash('sha1').update(buf).digest('hex').slice(0, 8))
      console.log(`${i + 1}/${targets.length} ${kind} ${id} ${(buf.length / 1024).toFixed(1)} КБ ${Date.now() - t0} мс`)
    } catch (error) {
      failures.push(id)
      console.error(`FAIL ${id}: ${error instanceof Error ? error.message : error}`)
    }
  }

  // Манифест: дискідегі бар суреттің бәрі (`--only` бөлшек жүгіртуінде ескілері сақталады).
  const known = new Set(targets.map((t) => t.id))
  const entries = new Map()
  for (const file of (await readdir(OUT_DIR)).sort()) {
    if (!file.endsWith('.webp')) continue
    const id = file.slice(0, -5)
    if (!known.has(id)) { await rm(path.join(OUT_DIR, file)); continue }
    const hash = written.get(id) ?? createHash('sha1').update(await readFile(path.join(OUT_DIR, file))).digest('hex').slice(0, 8)
    entries.set(id, hash)
  }
  const body = [...entries].map(([id, hash]) => `  '${id}': '${hash}',`).join('\n')
  await writeFile(MANIFEST, `// АВТОМАТТЫ: scripts/renderTemplateThumbs.mjs. Қолмен өзгертпе.
// id → суреттің хэші (кэшті жаңарту үшін). Сурет: /templates/thumbs/<id>.webp, 320×240.
export const TEMPLATE_THUMBS: Readonly<Record<string, string>> = {
${body}
}
`)
  console.log(`дайын: ${entries.size} сурет, қате: ${failures.length}${failures.length ? ' → ' + failures.join(', ') : ''}`)
} finally {
  await browser.close()
}
if (failures.length) process.exitCode = 1
