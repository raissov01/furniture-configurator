'use client'

/**
 * Сол жақ панель: параметрлер. Мұнда геометрия ЕСЕПТЕЛМЕЙДІ — тек конфиг
 * өзгереді, қалғанын ядро жасайды (CLAUDE.md §3).
 */

import { Button, Field, NumberInput, SectionTitle, Select, Toggle } from '@/components/ui'
import { backMaterials, carcassMaterials } from '@/lib/defaults'
import { findTemplate } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import type { CabinetConfig, Section } from '@/src/core/index'

const materialOptions = (list: typeof carcassMaterials) =>
  list.map((m) => ({ value: m.id, label: m.name }))

function SectionEditor({ section, index }: { section: Section; index: number }) {
  const editSection = useConfigurator((s) => s.editSection)
  const removeSection = useConfigurator((s) => s.removeSection)
  const canRemove = useConfigurator((s) => s.cabinet.sections.length > 1)

  const shelves = section.contents.find((c) => c.kind === 'shelves')

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-neutral-500">Секция {index + 1}</span>
        <Button onClick={() => removeSection(index)} disabled={!canRemove} title="Удалить секцию">
          ✕
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Ширина">
          <Select
            value={section.widthMode}
            onChange={(widthMode) =>
              editSection(
                index,
                widthMode === 'fixed'
                  ? { widthMode, width: section.width ?? 400 }
                  : { widthMode, width: undefined },
                'section.widthMode',
              )
            }
            options={[
              { value: 'flex', label: 'Гибкая (делит остаток)' },
              { value: 'fixed', label: 'Фиксированная' },
            ]}
          />
        </Field>
        <Field label="мм" hint={section.widthMode === 'flex' ? 'считается' : undefined}>
          <NumberInput
            value={section.width ?? 0}
            min={100}
            step={10}
            onChange={(width) => editSection(index, { width }, 'section.width')}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Полок">
          <NumberInput
            value={shelves?.count ?? 0}
            min={0}
            max={20}
            onChange={(count) =>
              editSection(
                index,
                {
                  contents: count > 0
                    ? [{ kind: 'shelves', count, shelfKind: shelves?.shelfKind ?? 'adjustable' }]
                    : [{ kind: 'empty' }],
                },
                'section.shelves',
              )
            }
          />
        </Field>
        <Field label="Тип полки">
          <Select
            value={shelves?.shelfKind ?? 'adjustable'}
            onChange={(shelfKind) =>
              editSection(
                index,
                { contents: [{ kind: 'shelves', count: shelves?.count ?? 1, shelfKind }] },
                'section.shelfKind',
              )
            }
            options={[
              { value: 'adjustable', label: 'На полкодержателях' },
              { value: 'fixed', label: 'Фиксированная' },
            ]}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Фасадов">
          <NumberInput
            value={section.fronts?.count ?? 0}
            min={0}
            max={8}
            onChange={(count) =>
              editSection(
                index,
                { fronts: count > 0 ? { count, mount: section.fronts?.mount ?? 'overlay' } : null },
                'section.fronts',
              )
            }
          />
        </Field>
        <Field label="Тип фасада">
          <Select
            value={section.fronts?.mount ?? 'overlay'}
            onChange={(mount) =>
              editSection(
                index,
                { fronts: { count: section.fronts?.count ?? 1, mount } },
                'section.frontMount',
              )
            }
            options={[
              { value: 'overlay', label: 'Накладной' },
              { value: 'inset', label: 'Вкладной' },
            ]}
          />
        </Field>
      </div>
    </div>
  )
}

export function Configurator({ invalidField }: { invalidField: string | null }) {
  const cabinet: CabinetConfig = useConfigurator((s) => s.cabinet)
  const edit = useConfigurator((s) => s.edit)
  const addSection = useConfigurator((s) => s.addSection)
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const setGalleryOpen = useConfigurator((s) => s.setGalleryOpen)
  const template = findTemplate(useConfigurator((s) => s.templateId))

  const invalid = (field: string) => invalidField === field
  /** Шаблон ұсынған аралық — қатты шектеу емес, тек бағдар. */
  const hint = (axis: 'height' | 'width' | 'depth') =>
    template ? `${template.range[axis].min}–${template.range[axis].max}` : undefined

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>Шаблон</SectionTitle>
        <Button onClick={() => setGalleryOpen(true)}>Выбрать</Button>
      </div>
      <div className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs dark:border-neutral-800">
        <div className="font-medium">{template ? template.name : 'Свой корпус'}</div>
        {template ? (
          <div className="mt-0.5 text-[11px] leading-snug text-neutral-400">{template.description}</div>
        ) : null}
      </div>

      <SectionTitle>Габарит — H × W × D, мм</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Высота (H)" hint={hint('height')}>
          <NumberInput
            value={cabinet.height} min={100} max={4000} step={10} invalid={invalid('cabinet.height')}
            onChange={(height) => edit('height', { height })}
          />
        </Field>
        <Field label="Ширина (W)" hint={hint('width')}>
          <NumberInput
            value={cabinet.width} min={100} max={4000} step={10} invalid={invalid('cabinet.width')}
            onChange={(width) => edit('width', { width })}
          />
        </Field>
        <Field label="Глубина (D)" hint={hint('depth')}>
          <NumberInput
            value={cabinet.depth} min={100} max={4000} step={10} invalid={invalid('cabinet.depth')}
            onChange={(depth) => edit('depth', { depth })}
          />
        </Field>
      </div>

      <SectionTitle>Конструкция</SectionTitle>
      <Field label="Метод сборки">
        <Select
          value={cabinet.construction}
          onChange={(construction) => edit('construction', { construction })}
          options={[
            { value: 'sidesOverlay', label: 'Боковины накрывают крышку и дно' },
            { value: 'topBottomOverlay', label: 'Крышка и дно накрывают боковины' },
          ]}
        />
      </Field>
      <Field label="Задняя стенка">
        <Select
          value={cabinet.back.mode}
          onChange={(mode) => edit('back', { back: { mode } })}
          options={[
            { value: 'overlay', label: 'Внакладку (на скобы)' },
            { value: 'groove', label: 'В паз 4 мм' },
          ]}
        />
      </Field>

      <SectionTitle>Материалы</SectionTitle>
      <Field label="Корпус">
        <Select
          value={cabinet.carcassMaterialId}
          onChange={(id) => {
            const m = carcassMaterials.find((x) => x.id === id)
            edit('carcassMaterial', {
              carcassMaterialId: id,
              ...(m?.defaultEdging ? { edging: m.defaultEdging } : {}),
            })
          }}
          options={materialOptions(carcassMaterials)}
        />
      </Field>
      <Field label="Фасад">
        <Select
          value={cabinet.frontMaterialId}
          onChange={(frontMaterialId) => edit('frontMaterial', { frontMaterialId })}
          options={materialOptions(carcassMaterials)}
        />
      </Field>
      <Field label="Задняя стенка">
        <Select
          value={cabinet.backMaterialId}
          onChange={(backMaterialId) => edit('backMaterial', { backMaterialId })}
          options={materialOptions(backMaterials)}
        />
      </Field>

      <div className="flex items-center justify-between pt-1">
        <SectionTitle>Секции ({cabinet.sections.length})</SectionTitle>
        <Button onClick={addSection} disabled={cabinet.sections.length >= 12}>
          + секция
        </Button>
      </div>
      <div className="space-y-2">
        {cabinet.sections.map((section, i) => (
          <SectionEditor key={section.id} section={section} index={i} />
        ))}
      </div>

      <SectionTitle>Вид</SectionTitle>
      <Toggle checked={showDimensions} onChange={setShowDimensions} label="Показывать габариты" />
    </div>
  )
}
