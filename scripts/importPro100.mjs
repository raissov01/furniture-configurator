#!/usr/bin/env node
/**
 * PRO100 v7.08 кітапханасының НОМЕНКЛАТУРАСЫН алады — `.meb` файл аттары
 * мен ішкі-бума жолдары ғана (docs/pro100/library-panel-report.md-ды қара).
 *
 * ⚠ ЗАҢДЫ ШЕКАРА (бүгін үш рет талқыланды): архивтің ӨЗІ (`.meb` мазмұны,
 * суреттер, 3D модельдер) жобаға КӨШІРІЛМЕЙДІ. Тек `unrar lb` (bare list —
 * жаймайды) арқылы алынған файл аттары мен жол құрылымы — солар да тек
 * КАТАЛОГ ретінде (санат ағашы + шкаф атаулары), Ecru-дың меншігі емес.
 *
 * Кіріс: `~/Downloads/PRO100 v7.08.rar` (6.6 ГБ, унраlanbайды).
 * Шығыс: `src/core/data/generated/pro100Library.json` — { path, name, group }[]
 *   - path  — «Мебель»-ден бастап файлдың бумасына дейінгі санат тізбегі
 *             (breadcrumb үшін, PRO100-дың «Mobilier BUCATARIE\...» өрісі)
 *   - name  — файл аты, `.meb` кеңейтімісіз
 *   - group — 'cabinet' (шкаф номенклатурасы бар бумалар) | 'accessory'
 *             (тұтқа/сорғыш/тоңазытқыш/жарық — құрылымы басқа, талданбайды)
 *
 * Талдау логикасы (Н/В, есік/ящик саны, ені) БҰЛ ФАЙЛДА ЖОҚ — ол
 * `src/core/data/pro100Catalog.ts`-те, `parseCabinetName()` ретінде, ЖЕКЕ
 * тестпен қорғалған (`tests/pro100Catalog.test.ts`). Осы скрипт тек
 * шикі атау/жол тізімін жазады, мағына шығармайды.
 *
 * Қайта жүргізу: `npm run import:pro100` (архив қажет, тек локальде бар).
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RAR_PATH = process.argv[2] ?? `${homedir()}/Downloads/PRO100 v7.08.rar`
const OUT_PATH = `${ROOT}src/core/data/generated/pro100Library.json`

// Аты «Мебель» бумасының қай ішкі бумасында жатуына қарай анықталады —
// шкаф нөмірленуі (Н/В/2дв/Мойка) осы бумаларда ғана мағыналы, қалғаны
// (тұтқа, сорғыш, жарық) мүлде басқа атау конвенциясы қолданады.
const CABINET_FOLDERS = new Set([
  '01 Кухни Модерн',
  '02 Кухни Классика',
  '03 Кухни от Гурьевой',
  '04 Шкафы, гардеробные',
  'MM IMPERIAL (Фабрика мебели)',
  'Шкафы комоды прихожие',
  'Лофт библиотека',
  'Мебель про',
])

function listMebFiles(rarPath) {
  // `lb` = bare list: тек жолдар, архив жаймайды — 6.6 ГБ-та бірден-бір
  // тәсіл (тапсырмада көрсетілгендей).
  const out = execFileSync('unrar', ['lb', rarPath], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
  })
  return out.split('\n').filter((line) => line.toLowerCase().endsWith('.meb'))
}

function toRow(rarEntry) {
  // "PRO100v7.08x64/Библиотека/Мебель/01 Кухни Модерн/.../В - 300 1дв.meb"
  const parts = rarEntry.split('/')
  const libIndex = parts.indexOf('Библиотека')
  // Библиотека табылмаса — бөгде жол, елемейміз (қорғаныш, бүгінге дейін
  // байқалмаған жағдай).
  if (libIndex === -1 || libIndex + 1 >= parts.length) return null
  const path = parts.slice(libIndex + 1, -1) // «Мебель»-ден бастап, файл атынсыз
  const fileName = parts[parts.length - 1]
  const name = fileName.replace(/\.meb$/i, '')
  const subfolder = path[1] // path[0] === 'Мебель'
  const group = CABINET_FOLDERS.has(subfolder) ? 'cabinet' : 'accessory'
  return { path, name, group }
}

function main() {
  const entries = listMebFiles(RAR_PATH)
  const rows = entries.map(toRow).filter((r) => r !== null)
  writeFileSync(OUT_PATH, JSON.stringify(rows), 'utf8')
  const cabinetCount = rows.filter((r) => r.group === 'cabinet').length
  console.log(`pro100Library.json: ${rows.length} жол (${cabinetCount} cabinet, ${rows.length - cabinetCount} accessory) -> ${OUT_PATH}`)
}

main()
