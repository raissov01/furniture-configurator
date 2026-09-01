'use client'

/**
 * «Деталь» — ерікті детальдар редакторы.
 *
 * НЕГЕ КЕРЕК. Параметрлі модель корпустық жиһаздың 90 пайызын жабады, бірақ
 * нақты тапсырыста параметрге сыймайтын деталь әрқашан табылады: столешница
 * астындағы царга, теледидардың артындағы панель, үстел үстіндегі сөре.
 * Ондай детальді «жоқ» деп айтқанша, цехқа өзі қосуға мүмкіндік берген
 * дұрыс — сонда конфигуратор бір ғана түрге емес, кез келген жиһазға жарайды.
 *
 * Деталь ЯДРОҒА қосылады (`config.customParts`), сондықтан ол 3D-де де,
 * деталировкада да, раскройда да, сметада да қалғанымен бірдей жүреді (§3).
 */

import { t as tr } from '@/lib/i18n'
import { useState } from 'react'
import { Button, Field, NumberInput, Select } from '@/components/ui'
import { useConfigurator, activeCabinet } from '@/store/configurator'
import type { CabinetConfig, Catalog, CustomPart } from '@/src/core/index'

type PresetId = 'worktop' | 'shelf' | 'rail' | 'backPanel' | 'blank'

/**
 * Дайын детальдар. Өлшемдері КОРПУСТЫҢ өз габаритінен есептеледі — цех
 * санды қолмен теруге отырмайды, ал керек болса кез келгенін түзете алады.
 */
function presetPart(
  id: PresetId,
  cabinet: CabinetConfig,
  thickness: number,
  index: number,
): Omit<CustomPart, 'id'> {
  const { height: H, width: W, depth: D } = cabinet
  const inner = Math.max(20, W - thickness * 2)
  switch (id) {
    case 'worktop':
      return {
        label: 'Столешница',
        length: W, width: D,
        position: { x: 0, y: H, z: 0 },
        plane: 'horizontal', edging: 'all',
      }
    case 'shelf':
      return {
        label: 'Полка',
        length: inner, width: Math.max(20, D - 100),
        position: { x: thickness, y: Math.round(H / 2), z: 20 },
        plane: 'horizontal', edging: 'front',
      }
    case 'rail':
      return {
        label: 'Царга',
        length: 100, width: inner,
        position: { x: thickness, y: Math.max(0, H - 100), z: 0 },
        plane: 'front', edging: 'front',
      }
    case 'backPanel':
      return {
        label: 'Задняя панель',
        length: H, width: W,
        position: { x: 0, y: 0, z: D },
        plane: 'front', edging: 'none',
      }
    case 'blank':
      return {
        label: `Деталь ${index}`,
        length: 400, width: 300,
        position: { x: 0, y: 0, z: 0 },
        plane: 'horizontal', edging: 'front',
      }
  }
}

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'worktop', label: 'Столешница' },
  { id: 'shelf', label: 'Полка' },
  { id: 'rail', label: 'Царга' },
  { id: 'backPanel', label: 'Задняя панель' },
  { id: 'blank', label: 'Пустая деталь' },
]

export function CustomParts({ catalog }: { catalog: Catalog }) {
  const open = useConfigurator((s) => s.partsOpen)
  const setOpen = useConfigurator((s) => s.setPartsOpen)
  const cabinet = useConfigurator(activeCabinet)
  const edit = useConfigurator((s) => s.edit)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!open) return null

  const parts = cabinet.customParts ?? []
  const thickness = catalog.materials.find((m) => m.id === cabinet.carcassMaterialId)?.thickness ?? 16

  const write = (next: CustomPart[], key: string) => edit(`customParts:${key}`, { customParts: next })

  const add = (preset: PresetId) => {
    // id ешқашан қайта пайдаланылмайды: өшірілген детальдің id-і жаңасына
    // тисе, присадка түзетуі жаңа детальға жабысып қалар еді.
    const used = new Set(parts.map((p) => p.id))
    let n = parts.length + 1
    while (used.has(`custom-${n}`)) n += 1
    const part: CustomPart = { id: `custom-${n}`, ...presetPart(preset, cabinet, thickness, n) }
    write([...parts, part], `add:${part.id}`)
    setExpanded(part.id)
  }

  const patch = (id: string, change: Partial<CustomPart>, key: string) =>
    write(parts.map((p) => (p.id === id ? { ...p, ...change } : p)), `${key}:${id}`)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-1 text-sm font-semibold">{tr('Свои детали')}</h2>
          <span className="text-[11px] text-neutral-500">
            {tr('в корпусе')}: <b className="tabular-nums">{parts.length}</b>
          </span>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button key={p.id} onClick={() => add(p.id)}>+ {tr(p.label)}</Button>
          ))}
        </div>

        {parts.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-neutral-500">
            {tr('Деталь — это любая панель, которую параметры корпуса не описывают: перемычка, царга, панель за телевизором, полка над столом. Она попадёт в деталировку, раскрой и смету наравне с остальными.')}
          </p>
        ) : (
          <div className="space-y-2">
            {parts.map((part) => (
              <div
                key={part.id}
                className="rounded-lg border border-neutral-200 p-2 dark:border-neutral-700"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={part.label}
                    onChange={(e) => patch(part.id, { label: e.target.value }, 'label')}
                    className="w-44 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <span className="tabular-nums text-[11px] text-neutral-500">
                    {part.length} × {part.width} {tr('мм')} · {tr(PLANE_NAME[part.plane])}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button onClick={() => setExpanded(expanded === part.id ? null : part.id)}>
                      {expanded === part.id ? tr('Свернуть') : tr('Изменить')}
                    </Button>
                    <Button onClick={() => write(parts.filter((p) => p.id !== part.id), `remove:${part.id}`)}>
                      {tr('Удалить')}
                    </Button>
                  </div>
                </div>

                {expanded === part.id ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Field label={tr('Плоскость')} hint={tr(PLANE_HINT[part.plane])}>
                      <Select
                        value={part.plane}
                        onChange={(plane) => patch(part.id, { plane }, 'plane')}
                        options={[
                          { value: 'horizontal' as const, label: tr('Лежит') },
                          { value: 'vertical' as const, label: tr('Стоит вдоль') },
                          { value: 'front' as const, label: tr('Смотрит вперёд') },
                        ]}
                      />
                    </Field>
                    <Field label={tr('Длина')} hint="мм">
                      <NumberInput value={part.length} min={20} max={4000}
                        onChange={(length) => patch(part.id, { length }, 'length')} />
                    </Field>
                    <Field label={tr('Ширина')} hint="мм">
                      <NumberInput value={part.width} min={20} max={4000}
                        onChange={(width) => patch(part.id, { width }, 'width')} />
                    </Field>
                    <Field label={tr('Кромка')}>
                      <Select
                        value={part.edging}
                        onChange={(edging) => patch(part.id, { edging }, 'edging')}
                        options={[
                          { value: 'none' as const, label: tr('Нет') },
                          { value: 'front' as const, label: tr('Передняя') },
                          { value: 'all' as const, label: tr('Все четыре') },
                        ]}
                      />
                    </Field>

                    <Field label="X" hint={tr('слева направо')}>
                      <NumberInput value={part.position.x}
                        onChange={(x) => patch(part.id, { position: { ...part.position, x } }, 'x')} />
                    </Field>
                    <Field label="Y" hint={tr('снизу вверх')}>
                      <NumberInput value={part.position.y}
                        onChange={(y) => patch(part.id, { position: { ...part.position, y } }, 'y')} />
                    </Field>
                    <Field label="Z" hint={tr('спереди назад')}>
                      <NumberInput value={part.position.z}
                        onChange={(z) => patch(part.id, { position: { ...part.position, z } }, 'z')} />
                    </Field>
                    <Field label={tr('Материал')}>
                      <Select
                        value={part.materialId ?? ''}
                        onChange={(id) => patch(part.id, id === ''
                          ? { materialId: undefined }
                          : { materialId: id }, 'material')}
                        options={[
                          { value: '', label: tr('Как корпус') },
                          ...catalog.materials.map((m) => ({ value: m.id, label: m.name })),
                        ]}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">
          {tr('Координаты — от левого-нижнего-переднего угла корпуса, в миллиметрах. Деталь можно вынести и за габарит: столешница выступает вперёд именно так.')}
        </p>
      </div>
    </div>
  )
}

const PLANE_NAME: Record<CustomPart['plane'], string> = {
  horizontal: 'Лежит',
  vertical: 'Стоит вдоль',
  front: 'Смотрит вперёд',
}

const PLANE_HINT: Record<CustomPart['plane'], string> = {
  horizontal: 'длина по X, ширина по Z',
  vertical: 'длина по Y, ширина по Z',
  front: 'длина по Y, ширина по X',
}
