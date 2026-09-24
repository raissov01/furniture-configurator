#!/usr/bin/env tsx
/**
 * CLI: конфиг JSON → деталировка.
 *   npm run cutlist -- examples/wardrobe.json
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import {
  CUT_LIST_COLUMNS, ConfigValidationError,
  edgeBandTotals, findNode, flattenTree, formatCutList, parseProjectV4,
} from '../core/index'
import type { Column, CutListRow, DrillPurpose } from '../core/index'

const PURPOSE_LABEL: Record<DrillPurpose, string> = {
  confirmat: 'конфирмат',
  dowel: 'шкант',
  minifix: 'минификс',
  shelfPin: 'полкодержатель',
  hinge: 'петля',
  runner: 'направляющая',
  leg: 'ножка',
  handle: 'ручка',
  facadeScrew: 'евровинт фасада',
}

function main(): number {
  const file = process.argv[2]
  if (!file) {
    console.error('Қолдану: npm run cutlist -- <project.json>')
    return 2
  }

  let project
  try {
    project = parseProjectV4(JSON.parse(readFileSync(resolve(file), 'utf8')))
  } catch (err) {
    if (err instanceof ZodError) {
      console.error(`Конфиг қатесі — ${file}:`)
      for (const issue of err.issues) {
        console.error(`  ${issue.path.join('.') || '(түбір)'}: ${issue.message}`)
      }
      return 1
    }
    throw err
  }

  const catalog = { materials: project.materials, edgeBands: project.edgeBands }
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

    const rows = formatCutList(panels, catalog)

    console.log(`\n${node.name}`)
    if (source?.kind === 'cabinet') {
      const cabinet = source.config
      console.log(`Габарит H × W × D: ${cabinet.height} × ${cabinet.width} × ${cabinet.depth} мм`)
      console.log(`Конструкция: ${cabinet.construction}, задняя стенка: ${cabinet.back.mode}`)
      console.log(`Секций: ${cabinet.sections.length}, перегородок: ${cabinet.sections.length - 1}\n`)
    }
    console.log(renderTable(rows))

    const pieces = rows.reduce((sum, r) => sum + r.qty, 0)
    console.log(`\nПозиций: ${rows.length}   Деталей: ${pieces}`)

    const holes = new Map<string, number>()
    for (const panel of panels) {
      for (const d of panel.drilling) {
        const key = `${PURPOSE_LABEL[d.purpose]} Ø${d.diameter}×${d.depth}`
        holes.set(key, (holes.get(key) ?? 0) + 1)
      }
    }
    if (holes.size > 0) {
      const total = [...holes.values()].reduce((a, b) => a + b, 0)
      console.log(`\nПрисадка: ${total} отв. — ${[...holes].map(([k, v]) => `${k}: ${v}`).join(', ')}`)
    }

    const bandNames = new Map(project.edgeBands.map((b) => [b.id, b.name]))
    for (const [bandId, metres] of edgeBandTotals(panels)) {
      console.log(`${bandNames.get(bandId) ?? bandId}: ${metres.toFixed(2)} м`)
    }
  }
  console.log('')
  return 0
}

function cellText(row: CutListRow, col: Column): string {
  return String(row[col.key])
}

function pad(text: string, width: number, align: 'left' | 'right'): string {
  const gap = ' '.repeat(Math.max(0, width - [...text].length))
  return align === 'right' ? gap + text : text + gap
}

function renderTable(rows: CutListRow[]): string {
  const cols = CUT_LIST_COLUMNS
  const widths = cols.map((c) => {
    const body = rows.map((r) => [...cellText(r, c)].length)
    return Math.max([...c.header].length, ...body)
  })

  // Топ тақырыбы: "ГОТОВЫЙ · клиент" мен "РЕЗ · цех" бөлек тұруы керек —
  // цех адамы клиенттің готовый өлшемін кесіп алмауы үшін.
  const groupRow: string[] = []
  for (let i = 0; i < cols.length; ) {
    const group = cols[i]?.group ?? ''
    let span = 1
    while (i + span < cols.length && (cols[i + span]?.group ?? '') === group && group !== '') span += 1
    const width = widths.slice(i, i + span).reduce((a, b) => a + b, 0) + (span - 1) * 3
    const label = group === '' ? '' : group
    const left = Math.max(0, Math.floor((width - [...label].length) / 2))
    groupRow.push(pad(' '.repeat(left) + label, width, 'left'))
    i += span
  }

  const header = cols.map((c, i) => pad(c.header, widths[i] ?? 0, c.align))
  const rule = widths.map((w) => '─'.repeat(w))
  const body = rows.map((r) => cols.map((c, i) => pad(cellText(r, c), widths[i] ?? 0, c.align)).join(' │ '))

  return [groupRow.join(' │ '), header.join(' │ '), rule.join('─┼─'), ...body].join('\n')
}

process.exit(main())
