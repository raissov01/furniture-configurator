'use client'

/**
 * PRO100 «Отчёты»: «Список деталей | Список корпусов | Расход материалов |
 * Калькуляция» қойындылары, кесте, астында «Печать / Копировать / Сохранить…»
 * және «Копировать всё / Сохранить всё… / OK».
 */

import { useMemo, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { panelDisplayLabel } from '@/lib/panelDisplay'
import { materialRows, partRows, tableText, type CabinetRow, type ReportGroup } from '@/lib/classicReports'
import type { Material } from '@/src/core/index'
import { useClassicView } from '@/store/classicView'
import { ClassicTabs, ClassicWindow } from '@/components/ClassicWindow'

type Tab = 'parts' | 'cabinets' | 'materials' | 'calculation'

export function ClassicReportsDialog(props: {
  groups: ReportGroup[]
  cabinets: CabinetRow[]
  materials: Material[]
  total: string | null
  onOpenQuote: () => void
}) {
  const open = useClassicView((s) => s.reportsOpen)
  return open ? <ReportsBody {...props} /> : null
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function ReportsBody({ groups, cabinets, materials, total, onOpenQuote }: {
  groups: ReportGroup[]; cabinets: CabinetRow[]; materials: Material[]; total: string | null; onOpenQuote: () => void
}) {
  const close = useClassicView((s) => s.setReportsOpen)
  const [tab, setTab] = useState<Tab>('parts')
  const [withGroup, setWithGroup] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const tables = useMemo(() => {
    const parts = partRows(groups, materials, (label) => panelDisplayLabel(label), withGroup)
    const partHead = [...(withGroup ? [tr('Группа')] : []), tr('Наименование'), tr('Длина'), tr('Ширина'), tr('Толщина'), tr('Кол-во'), tr('Материал')]
    return {
      parts: { head: partHead, rows: parts.map((row) => [...(withGroup ? [row.group] : []), row.name, row.length, row.width, row.thickness, row.count, row.material]) },
      cabinets: { head: [tr('Наименование'), 'H', 'W', 'D', tr('Деталей')], rows: cabinets.map((row) => [row.name, row.height, row.width, row.depth, row.parts]) },
      materials: { head: [tr('Материал'), tr('Толщина'), tr('Деталей'), tr('Площадь, м²')], rows: materialRows(groups, materials).map((row) => [row.material, row.thickness, row.parts, row.areaM2]) },
      calculation: { head: [tr('Итого клиенту')], rows: [[total ?? tr('Цены не заданы')]] },
    } satisfies Record<Tab, { head: string[]; rows: (string | number)[][] }>
  }, [groups, cabinets, materials, total, withGroup])
  const current = tables[tab]
  const numeric = (index: number) => current.rows.some((row) => typeof row[index] === 'number')
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => setNotice(tr('Скопировано')), () => setNotice(tr('Не удалось скопировать — разрешите доступ к буферу обмена')))
  }
  const allText = (separator: '\t' | ';') => (Object.keys(tables) as Tab[]).map((key) => tableText(tables[key].head, tables[key].rows, separator)).join('\n\n')
  return <ClassicWindow id="classic-reports" title={tr('Отчёты')} testId="classic-reports-dialog" width={800}
    onClose={() => close(false)} className="p100-reports"
    actions={[
      { label: tr('Копировать всё'), onClick: () => copy(allText('\t')) },
      { label: tr('Сохранить всё…'), onClick: () => download('reports.csv', allText(';')) },
      { label: tr('OK'), primary: true, onClick: () => close(false), testId: 'reports-ok' },
    ]}>
    <ClassicTabs label={tr('Отчёты')} value={tab} onChange={(value) => { setTab(value); setNotice(null) }} tabs={[
      { value: 'parts', label: tr('Список деталей') },
      { value: 'cabinets', label: tr('Список корпусов') },
      { value: 'materials', label: tr('Расход материалов') },
      { value: 'calculation', label: tr('Калькуляция') },
    ]} />
    <div className="p100-tab-page">
      <div className="p100-report-table" role="region" aria-label={tr('Отчёты')} tabIndex={0}>
        <table>
          <thead><tr>{current.head.map((cell, index) => <th key={cell} className={numeric(index) ? 'num' : undefined}>{cell}</th>)}</tr></thead>
          <tbody>{current.rows.map((row, rowIndex) => <tr key={rowIndex}>
            {row.map((cell, index) => <td key={index} className={typeof cell === 'number' ? 'num' : undefined}>{cell}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {tab === 'parts' ? <label className="p100-check"><input type="checkbox" checked={withGroup} onChange={(event) => setWithGroup(event.target.checked)} />
        {tr('Показывать имя верхней группы')}</label> : null}
      <div className="p100-report-actions">
        <button type="button" className="p100-window-button" onClick={() => window.print()}>{tr('Печать')}</button>
        <button type="button" className="p100-window-button" onClick={() => copy(tableText(current.head, current.rows, '\t'))}>{tr('Копировать')}</button>
        <button type="button" className="p100-window-button" onClick={() => download(`${tab}.csv`, tableText(current.head, current.rows, ';'))}>{tr('Сохранить…')}</button>
        {tab === 'calculation' ? <button type="button" className="p100-window-button" onClick={() => { close(false); onOpenQuote() }}>{tr('Смета и раскрой')}</button> : null}
        {notice ? <span role="status" className="p100-hint">{notice}</span> : null}
      </div>
    </div>
  </ClassicWindow>
}
