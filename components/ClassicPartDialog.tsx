'use client'

/**
 * Корпус детальінің «Свойства» (PRO100: таңдалған детальге қос шерту).
 *
 * Параметрлік корпуста деталь өлшемі габариттен ЕСЕПТЕЛЕДІ (CLAUDE.md §4),
 * сондықтан мұнда өзгертілмейді: Длина / Ширина / Толщина, материал, 4 кромка
 * және рез өлшемі көрсетіледі; өзгерту жолы — «Свойства корпуса…» не
 * «Присадка…». Еркін доска мен өз бөлшегі өз терезесінде өңделеді.
 */

import { t as tr } from '@/lib/i18n'
import { panelDisplayLabel } from '@/lib/panelDisplay'
import type { Catalog, Panel } from '@/src/core/index'
import { ClassicWindow } from '@/components/ClassicWindow'

const EDGE_LABEL: Record<'L1' | 'L2' | 'W1' | 'W2', string> = {
  L1: 'L1 — длинная, лицевая', L2: 'L2 — длинная, задняя', W1: 'W1 — короткая', W2: 'W2 — короткая',
}

export function ClassicPartDialog({ panel, catalog, onClose, onCabinetProperties, onDrilling }: {
  panel: Panel
  catalog: Catalog
  onClose: () => void
  onCabinetProperties: () => void
  onDrilling: (() => void) | null
}) {
  const material = catalog.materials.find((entry) => entry.id === panel.materialId)
  const band = (id: string | undefined) => id ? catalog.edgeBands.find((entry) => entry.id === id) : undefined
  const row = (label: string, value: string | number) => <div className="p100-form-row">
    <span>{label}</span><input readOnly value={value} />
  </div>
  return <ClassicWindow id="classic-part" title={`${tr('Свойства')}: ${panelDisplayLabel(panel.label)}`} testId="classic-part-dialog" width={454}
    onClose={onClose} onOk={onClose}
    actions={[
      { label: tr('Свойства корпуса…'), onClick: onCabinetProperties, testId: 'part-cabinet-properties' },
      ...(onDrilling ? [{ label: tr('Присадка…'), onClick: onDrilling }] : []),
      { label: tr('OK'), primary: true, onClick: onClose, testId: 'part-ok' },
    ]}>
    <div className="p100-tab-page p100-part-page">
      <fieldset className="p100-group-box">
        <legend>{tr('Размеры (готовый)')}</legend>
        <div className="p100-form-grid">
          {row(tr('Длина'), panel.finishedLength)}
          {row(tr('Ширина'), panel.finishedWidth)}
          {row(tr('Толщина'), material?.thickness ?? '—')}
          {row(tr('Рез · цех'), `${panel.cutLength} × ${panel.cutWidth}`)}
        </div>
      </fieldset>
      <fieldset className="p100-group-box">
        <legend>{tr('Материал')}</legend>
        <div className="p100-form-grid">{row(tr('Материал'), material?.name ?? panel.materialId)}</div>
      </fieldset>
      <fieldset className="p100-group-box">
        <legend>{tr('Кромка')}</legend>
        <div className="p100-form-grid">
          {(['L1', 'L2', 'W1', 'W2'] as const).map((edge) => {
            const spec = band(panel.edges[edge]?.bandId)
            return <div key={edge}>{row(tr(EDGE_LABEL[edge]), spec ? `${spec.name} · ${spec.thickness} мм` : tr('нет'))}</div>
          })}
        </div>
      </fieldset>
      <p className="p100-hint">{tr('Размер детали считается из габарита корпуса. Меняйте его в «Свойствах корпуса».')}</p>
    </div>
  </ClassicWindow>
}
