'use client'

/**
 * PRO100 «Свет» терезесі: «Наименование | Значение» ағашы. «эффекты» мен
 * «свет» топтарының әр жолында құсбелгі мен жүгірткі бар; өзгеріс сахнаға
 * бірден түседі (тек көрініс — раскройға, бағаға әсері жоқ). Жобаның өз
 * жарық көздері (нүкте, прожектор, күн) «Источники света…» арқылы.
 */

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { LIGHTING_TREE, clampPercent } from '@/lib/classicLighting'
import { useConfigurator } from '@/store/configurator'
import { useClassicView } from '@/store/classicView'
import { ClassicWindow } from '@/components/ClassicWindow'

export function ClassicLightDialog() {
  const open = useClassicView((s) => s.lightDialogOpen)
  return open ? <LightDialogBody /> : null
}

function LightDialogBody() {
  const lighting = useClassicView((s) => s.lighting)
  const setChannel = useClassicView((s) => s.setLightingChannel)
  const reset = useClassicView((s) => s.resetLighting)
  const close = useClassicView((s) => s.setLightDialogOpen)
  const setRenderOpen = useConfigurator((s) => s.setRenderOpen)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  return <ClassicWindow id="classic-light" title={tr('Свет')} testId="classic-light-dialog" width={440}
    onClose={() => close(false)} onOk={() => close(false)}
    actions={[
      { label: tr('По умолчанию'), onClick: reset, testId: 'light-reset' },
      { label: tr('Источники света…'), onClick: () => { close(false); setRenderOpen(true) } },
      { label: tr('OK'), primary: true, onClick: () => close(false), testId: 'light-ok' },
    ]}>
    <div className="p100-light-tree" role="tree" aria-label={tr('Свет')}>
      <div className="p100-light-head"><span>{tr('Наименование')}</span><span>{tr('Значение')}</span></div>
      {LIGHTING_TREE.map((group) => <div key={group.group} role="group">
        <button type="button" className="p100-light-group" aria-expanded={!collapsed[group.group]}
          onClick={() => setCollapsed((current) => ({ ...current, [group.group]: !current[group.group] }))}>
          <span className="p100-tree-toggle" aria-hidden="true">{collapsed[group.group] ? '+' : '−'}</span>
          <b>{tr(group.label)}</b>
        </button>
        {collapsed[group.group] ? null : group.rows.map((row) => {
          const channel = lighting[row.key]
          return <div key={row.key} role="treeitem" className="p100-light-row" style={{ paddingLeft: 10 + row.depth * 14 }}
            data-testid={`light-${row.key}`}>
            <label>
              <input type="checkbox" checked={channel.on} onChange={(event) => setChannel(row.key, { on: event.target.checked })} />
              {tr(row.label)}
            </label>
            <input type="range" min={0} max={100} value={channel.value} disabled={!channel.on} aria-label={tr(row.label)}
              onChange={(event) => setChannel(row.key, { value: clampPercent(Number(event.target.value)) })} />
          </div>
        })}
      </div>)}
    </div>
  </ClassicWindow>
}
