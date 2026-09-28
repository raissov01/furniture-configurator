'use client'

/**
 * «Жоба» терезесі: МАТЕРИАЛДАР мен ЖИНАУ РЕТІ.
 *
 * Екеуі де сметаның ішінде емес, бөлек тұр — себебі екеуінің сұрағы басқа:
 * материал тізімі «нені ауыстырсам, қайда тиеді» дегенге жауап береді,
 * ал жинау реті цехтағы адамға «алдымен нені» дегенді айтады.
 *
 * Мұнда ештеңе ЕСЕПТЕЛМЕЙДІ — бәрі ядродан (`projectUsage`, `assemblySteps`).
 */

import { t as tr } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ASSEMBLY_STAGE_NAMES, assemblySteps, projectUsage, rolesLabel } from '@/src/core/index'
import type { AssemblyStage, Catalog, Panel, ProjectInfo } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { useModalLayer } from '@/lib/useModalLayer'

type Tab = 'materials' | 'assembly' | 'info'

/** Реквизит өрісі: input стилі бүкіл жобада бірдей — QuoteView-дегі «Заказчик»-пен бірдей. */
const FIELD_CLASS = 'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900'

const INFO_FIELDS: { key: keyof ProjectInfo; label: string; type: 'text' | 'date' }[] = [
  { key: 'orderNo', label: 'Заказ', type: 'text' },
  { key: 'date', label: 'Дата', type: 'date' },
  { key: 'client', label: 'Заказчик', type: 'text' },
  { key: 'designer', label: 'Дизайнер', type: 'text' },
]

const squareMetres = (mm2: number): string => (mm2 / 1_000_000).toFixed(2)

const STAGE_COLOR: Record<AssemblyStage, string> = {
  carcass: 'bg-sky-500',
  fixed: 'bg-emerald-500',
  movable: 'bg-amber-500',
  front: 'bg-violet-500',
}

export function ProjectPanel({ panels, catalog }: { panels: Panel[]; catalog: Catalog }) {
  const open = useConfigurator((s) => s.projectOpen)
  const setOpen = useConfigurator((s) => s.setProjectOpen)
  const { zIndex, isTop } = useModalLayer(open, 'project', () => setOpen(false))

  const setHovered = useConfigurator((s) => s.setHovered)
  // Тізімдегі жол мен 3D бір-бірін БІЛЕДІ: жолды бассаң, сахна сол қадамға
  // тұрады да, деталь бөлектеледі. Цехтағы адам «мынау қайсысы» дегенді
  // қағаздан да, экраннан да бір қимылмен табады.
  const setSelected = useConfigurator((s) => s.setSelected)
  const selected = useConfigurator((s) => s.selected)
  const assemblyStep = useConfigurator((s) => s.assemblyStep)
  const setAssemblyStep = useConfigurator((s) => s.setAssemblyStep)
  const projectInfo = useConfigurator((s) => s.projectInfo)
  const editProjectInfo = useConfigurator((s) => s.editProjectInfo)
  const [tab, setTab] = useState<Tab>('materials')

  const usage = useMemo(() => {
    try {
      return projectUsage(panels, catalog)
    } catch {
      return null
    }
  }, [panels, catalog])
  const steps = useMemo(() => assemblySteps(panels), [panels])

  if (!open) return null

  return (
    <div
      style={{ zIndex }}
      className="fixed inset-0 flex items-start justify-center overflow-auto bg-black/40 p-4"
      onClick={() => { if (isTop) setOpen(false) }}

    >
      <div
        className="w-full max-w-3xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-sm font-semibold">{tr('Проект')}</h2>
          <Button active={tab === 'materials'} onClick={() => setTab('materials')}>{tr('Материалы')}</Button>
          <Button active={tab === 'assembly'} onClick={() => setTab('assembly')}>{tr('Сборка')}</Button>
          <Button active={tab === 'info'} onClick={() => setTab('info')}>{tr('Реквизиты')}</Button>
          <span className="text-[11px] text-neutral-500">
            {tr('деталей')}: <b className="tabular-nums">{panels.length}</b>
          </span>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {tab === 'materials' ? (
          !usage ? (
            <p className="text-xs text-neutral-500">{tr('Нет деталей.')}</p>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="py-1 text-left">{tr('Материал')}</th>
                    <th className="py-1 text-right">{tr('Деталей')}</th>
                    <th className="py-1 text-right">{tr('Площадь')}</th>
                    <th className="py-1 text-right">{tr('Самая большая')}</th>
                    <th className="py-1 text-left">{tr('Где стоит')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.materials.map((m) => (
                    <tr key={m.materialId} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="py-1.5">
                        {m.materialName}
                        <span className="ml-1 text-neutral-400">{m.thickness} мм</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{m.parts}</td>
                      <td className="py-1.5 text-right tabular-nums">{squareMetres(m.area)} м²</td>
                      <td className="py-1.5 text-right tabular-nums text-neutral-500">
                        {m.largest.length}×{m.largest.width}
                      </td>
                      <td className="py-1.5 text-neutral-500">{rolesLabel(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {usage.edges.length > 0 ? (
                <div>
                  <h3 className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">{tr('Кромка')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {usage.edges.map((e) => (
                      <span key={e.bandId} className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] dark:border-neutral-700">
                        {e.bandName}
                        <span className="ml-1 font-medium tabular-nums">{e.metres.toFixed(1)} {tr('м')}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="text-[10px] leading-relaxed text-neutral-400">
                {tr('Листы здесь не считаются: их знает только раскрой. Площадь — по готовому размеру.')}
              </p>
            </div>
          )
        ) : tab === 'assembly' ? (
          <div className="space-y-1">
            {steps.map((step, i) => {
              const previous = steps[i - 1]
              const newStage = !previous || previous.stage !== step.stage
              return (
                <div key={step.panelId}>
                  {newStage ? (
                    <div className="mt-3 mb-1 flex items-center gap-2 first:mt-0">
                      <span className={cn('inline-block h-2 w-2 rounded-full', STAGE_COLOR[step.stage])} />
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                        {tr(ASSEMBLY_STAGE_NAMES[step.stage])}
                      </span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    data-step={step.step}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      selected === step.panelId && 'bg-amber-100 dark:bg-amber-900/40',
                      // Осы қадамға дейін жиналғаны — солғын емес, жиналмағаны солғын.
                      assemblyStep !== null && step.step > assemblyStep && 'opacity-40',
                    )}
                    onMouseEnter={() => setHovered(step.panelId)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      setAssemblyStep(step.step)
                      setSelected(step.panelId)
                    }}
                  >
                    <span className="w-6 shrink-0 text-right tabular-nums text-neutral-400">{step.step}</span>
                    <span className="flex-1">{step.label}</span>
                    <span className="text-neutral-500">{tr(step.direction)}</span>
                    {step.holes > 0 ? (
                      <span className="tabular-nums text-[11px] text-neutral-400">
                        {step.holes} {tr('отв.')}
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })}
            <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">
              {tr('Наведите на строку — деталь подсветится в 3D, нажмите — корпус соберётся до этого шага. Порядок выводится из геометрии: снизу вверх, снаружи внутрь, крышка последней.')}
            </p>
          </div>
        ) : (
          <div className="max-w-sm space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {INFO_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-xs">
                  <span className="text-neutral-500">{tr(f.label)}</span>
                  <input
                    type={f.type}
                    value={projectInfo[f.key] ?? ''}
                    onChange={(e) => editProjectInfo({ [f.key]: e.target.value })}
                    className={FIELD_CLASS}
                  />
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-neutral-500">{tr('Примечание')}</span>
              <textarea
                value={projectInfo.note ?? ''}
                onChange={(e) => editProjectInfo({ note: e.target.value })}
                rows={3}
                className={FIELD_CLASS}
              />
            </label>
            <p className="text-[10px] leading-relaxed text-neutral-400">
              {tr('Реквизиты попадают в КП и в сборочный чертёж для цеха. Пустое поле нигде не печатается.')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
