#!/usr/bin/env tsx
/**
 * Экспорт: конфиг JSON → цехқа арналған файлдар.
 *   npm run export -- examples/wardrobe.json --out dist/wardrobe
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import {
  ConfigValidationError, assemblyDrawingPdf, cabinetToDxfFiles, cutListToCsv,
  cutListToXlsx, drillingToCsv, findNode, flattenTree, mergeSettings, parseProjectV4,
} from '../core/index'

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets')

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

async function main(): Promise<number> {
  const file = process.argv[2]
  if (!file || file.startsWith('--')) {
    console.error('Қолдану: npm run export -- <project.json> [--out dist/]')
    return 2
  }
  const outRoot = resolve(arg('out', 'dist'))

  let project
  try {
    project = parseProjectV4(JSON.parse(readFileSync(resolve(file), 'utf8')))
  } catch (err) {
    if (err instanceof ZodError) {
      console.error(`Конфиг қатесі — ${file}:`)
      for (const issue of err.issues) console.error(`  ${issue.path.join('.') || '(түбір)'}: ${issue.message}`)
      return 1
    }
    throw err
  }

  const catalog = { materials: project.materials, edgeBands: project.edgeBands }
  const fonts = {
    regular: new Uint8Array(readFileSync(join(ASSETS, 'DejaVuSans-subset.ttf'))),
    bold: new Uint8Array(readFileSync(join(ASSETS, 'DejaVuSans-Bold-subset.ttf'))),
  }

  console.log(`\nПроект: ${project.name}`)

  let scene
  try {
    scene = flattenTree(project.root, catalog, project.settings, project.layers)
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(`\n✗ ${project.name}\n  ${err.message}`)
      return 1
    }
    throw err
  }

  for (const node of scene.nodes) {
    const { panels } = node
    const source = findNode(project.root, node.nodeId)
    const cabinet = source?.kind === 'cabinet' ? source.config : undefined

    // Tree ids are data, not paths: a slash or '..' must not escape --out.
    const directoryId = /^\.+$/.test(node.nodeId)
      ? node.nodeId.replaceAll('.', '%2E') : encodeURIComponent(node.nodeId)
    const dir = join(outRoot, directoryId)
    mkdirSync(join(dir, 'dxf'), { recursive: true })

    const written: [string, number][] = []
    const write = (path: string, data: string | Uint8Array) => {
      writeFileSync(join(dir, path), data)
      written.push([path, typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength])
    }

    // §O6: ойма бар панельдің рез координатасын дұрыс шығару үшін
    // generateCabinet-пен ДӘЛ сол catalog/settings берілуі керек.
    const dxfOptions = { catalog, settings: mergeSettings(project.settings, cabinet?.settings) }
    for (const [name, content] of cabinetToDxfFiles(panels, dxfOptions)) {
      // A free board's panel id is also user data. Encode the complete filename
      // so slashes cannot traverse directories and literal '%' ids stay distinct.
      write(join('dxf', encodeURIComponent(name)), content)
    }
    write('cutlist.csv', cutListToCsv(panels, catalog))
    write('drilling.csv', drillingToCsv(panels))
    write('cutlist.xlsx', cutListToXlsx(panels, catalog, project.name))
    if (cabinet) {
      write('assembly.pdf', await assemblyDrawingPdf({
        cabinet, panels, catalog, projectName: project.name, fonts, info: project.info,
      }))
    }

    console.log(`\n${node.name}\n  → ${dir}`)
    if (!cabinet) console.log('  Жинау PDF-і тек параметрлік корпусқа жасалады.')
    const dxfCount = written.filter(([p]) => p.startsWith('dxf')).length
    const dxfBytes = written.filter(([p]) => p.startsWith('dxf')).reduce((s, [, b]) => s + b, 0)
    console.log(`  ${String(dxfCount).padStart(3)} × dxf/*.dxf   ${kb(dxfBytes)}`)
    for (const [path, bytes] of written.filter(([p]) => !p.startsWith('dxf'))) {
      console.log(`      ${path.padEnd(16)} ${kb(bytes)}`)
    }
  }
  console.log('')
  return 0
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} КБ`

process.exit(await main())
