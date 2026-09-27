'use client'

/**
 * Сол жақ панель: параметрлер. Мұнда геометрия ЕСЕПТЕЛМЕЙДІ — тек конфиг
 * өзгереді, қалғанын ядро жасайды (CLAUDE.md §3).
 *
 * PRO100-дың Properties идеясы (docs/pro100/ui-design.md): тоғызға жуық
 * жылжымалы «▶» бөлімнің арасынан керегін іздеудің орнына ТӨРТ ҚОСЫМШАҒА
 * топтаймыз — Общее (өлшем және орын осында) · Материал · Отчёты · Производство. Бөлімдердің
 * ІШІ өзгермейді (бар компоненттер сол күйі), тек орналасуы топталады.
 *
 * PRO100 v7.08-нің нақты табтары — General · Material · Reports. Біздегі
 * төртінші «Производство» өндірістік құралдарға сілтейді: присадка мен DXF.
 * Олардың нақты редакторлары (смета, присадка, экспорт) бөлек
 * терезелер болып қала береді — мұнда тек СІЛТЕЙТІН қысқаша үзінді, ешнәрсе
 * қайта жазылмайды.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { t as tr, tf } from '@/lib/i18n'
import { CABINET_DIMENSION_MAX, CABINET_DIMENSION_MIN, dimensionRangeHint } from '@/lib/dimensionHint'
import { Button, Collapsible, Field, NumberInput, SectionTitle, Select, Toggle } from '@/components/ui'
import { DecorPicker } from '@/components/DecorPicker'
import { ExportMenu } from '@/components/ExportMenu'
import { cn } from '@/lib/cn'
import { enableCornerCabinet } from '@/lib/cornerTransition'
import { drawerFillerStep } from '@/lib/drawerFillerStep'
import { drawerContentWithCount } from '@/lib/drawerContent'
import { fixtureChoiceDisabled } from '@/lib/f07FixtureChoice'
import { updateFixtureAt } from '@/lib/f07FixtureDetails'
import { removeSectionContentAt, replaceSectionContent, updateSectionContentAt } from '@/lib/f07SectionContents'
import { showLegacyDrawerProfileWarning } from '@/lib/legacyDrawerProfile'
import { compatibleHinges, previewFrontEdit } from '@/lib/frontEdit'
import { commitPropertiesName } from '@/lib/propertiesSession'
import { sectionWidths } from '@/lib/sectionWidths'
import { parseShelfHeights, shelfCountChange, shelfHeightsChange } from '@/lib/shelfDraft'
import { matchTemplateId } from '@/lib/templateMatch'
import {
  APPLIANCES, APPLIANCE_NICHE_MODELS, DEFAULT_SETTINGS, FILLINGS, HANDLE_POSITIONS, MILLING_PATTERNS,
  WORKTOP_FIXTURE_MODELS,
  ConfigValidationError,
  defaultHandleSpec, defaultMillingSpec, findTemplate, formatCutList, handlePositionName, millingPattern,
  roomWalls, wallById, walkTree,
} from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import { wallAttachedPlacements } from '@/store/treeAdapters'
import type {
  ApplianceKind, CabinetConfig, CabinetFixture, Catalog, FillingKind, HandleSpec, Material, MillingSpec,
  Panel, RailKind, RailPosition, Section, SectionContent, SectionFronts, WallId,
} from '@/src/core/index'

const materialOptions = (list: Material[]) => list.map((m) => ({ value: m.id, label: m.name }))

/** Металл жәшік жүйелері: оларда қосымша өріс көрінеді. */
const METAL_BOX_IDS: string[] = ['legrabox', 'tandembox', 'merivobox']

/** Корпус пен фасадқа — қалың плита, арт қабырғаға — жұқа. */
const isCarcass = (m: Material) => m.thickness >= 10

function SectionEditor({ section, index, computedWidth, invalidField, onDraftValidityChange }: {
  section: Section; index: number; computedWidth: number | undefined; invalidField: string | null
  onDraftValidityChange?: ((field: string, invalid: boolean) => void) | undefined
}) {
  const editSection = useConfigurator((s) => s.editSection)
  const removeSection = useConfigurator((s) => s.removeSection)
  const catalog = useConfigurator((s) => s.catalog)
  const cabinet = useConfigurator(activeCabinet)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const setShopOpen = useConfigurator((s) => s.setShopOpen)
  const [frontError, setFrontError] = useState<{ field: string; message: string; allowed?: string | undefined; control: string } | null>(null)
  const frontDraftField = `sections[${index}].fronts`
  useEffect(() => {
    setFrontError(null)
    onDraftValidityChange?.(frontDraftField, false)
  }, [section])
  const editFronts = (patch: Partial<SectionFronts>, field: string) => {
    const result = previewFrontEdit(cabinet, index, patch, catalog, settings)
    if (!result.ok) {
      setFrontError({ ...result, control: field })
      onDraftValidityChange?.(frontDraftField, true)
      return
    }
    setFrontError(null)
    onDraftValidityChange?.(frontDraftField, false)
    editSection(index, { fronts: result.fronts }, field)
  }
  const cabFrontMat = useConfigurator((s) => activeCabinet(s).frontMaterialId)
  // Фасадқа жарамды декорлар: ХДФ (3 мм) фасад болмайды.
  const sectionFrontMats = useMemo(() => catalog.materials.filter((m) => m.thickness >= 10), [catalog])
  const canRemove = useConfigurator((s) => activeCabinet(s).sections.length > 1)

  const shopGap = useConfigurator((s) => s.shop.settings.frontGap ?? DEFAULT_SETTINGS.frontGap)
  const cabinetHeight = useConfigurator((s) => activeCabinet(s).height)

  const shelves = section.contents.find((c) => c.kind === 'shelves')
  const shelfContentIndex = section.contents.findIndex((c) => c.kind === 'shelves')
  const shelfAtField = `sections[${index}].contents[${shelfContentIndex}].at`
  const [heightsDraft, setHeightsDraft] = useState((shelves?.at ?? []).join(', '))
  const [heightsError, setHeightsError] = useState(false)
  useEffect(() => { setHeightsDraft((shelves?.at ?? []).join(', ')) }, [shelves?.at])
  const stand = section.contents.find((c) => c.kind === 'stand')
  const drawers = section.contents.find((c) => c.kind === 'drawers')
  const drawerContentIndex = section.contents.findIndex((c) => c.kind === 'drawers')
  const fillerStep = drawerFillerStep(catalog.materials, cabinet.carcassMaterialId)
  const rod = section.contents.find((c) => c.kind === 'rod')
  const filling = section.contents.find((c) => c.kind === 'filling')
  const appliance = section.contents.find((c) => c.kind === 'appliance')

  /**
   * Толтырылым АСТЫҢҒЫДАН жоғары қарай жиналады: ящиктер төменде, сөрелер
   * үстінде. Нақты жиһаз дәл солай жиналады, ал реті UI-да ойлап табылмайды.
   */
  const setFill = (next: {
    shelfCount?: number
    shelfKind?: 'adjustable' | 'fixed'
    shelfInsets?: NonNullable<Extract<SectionContent, { kind: 'shelves' }>['insets']>
    shelfAt?: number[] | null
    standCount?: number
    drawerCount?: number
    hasRod?: boolean
    filling?: FillingKind | null
    appliance?: ApplianceKind | null
  }) => {
    const shelfCount = next.shelfCount ?? shelves?.at?.length ?? shelves?.count ?? 0
    const shelfKind = next.shelfKind ?? shelves?.shelfKind ?? 'adjustable'
    // Шегіністер мен нақты биіктіктер ҚАЙТА ҚҰРУДА жоғалмауы керек: бұл
    // тізім әр өзгеріс сайын нөлден жиналады.
    const shelfInsets = next.shelfInsets ?? (shelves?.kind === 'shelves' ? shelves.insets : undefined)
    const shelfAt = next.shelfAt === undefined
      ? (shelves?.kind === 'shelves' ? shelves.at : undefined)
      : (next.shelfAt ?? undefined)
    const standCount = next.standCount ?? (stand?.kind === 'stand' ? stand.count : 0)
    const drawerCount = next.drawerCount ?? drawers?.count ?? 0
    const hasRod = next.hasRod ?? rod !== undefined
    let contents: SectionContent[] = section.contents
    const replace = (kind: SectionContent['kind'], value: SectionContent | null) => {
      contents = replaceSectionContent(contents, kind, value)
    }
    if (next.appliance !== undefined) replace('appliance', next.appliance
      ? { kind: 'appliance', appliance: next.appliance, ...(appliance?.height ? { height: appliance.height } : {}) } : null)
    if (next.drawerCount !== undefined) replace('drawers', drawerContentWithCount(drawers, drawerCount))
    if (next.shelfCount !== undefined || next.shelfKind !== undefined || next.shelfInsets !== undefined || next.shelfAt !== undefined) {
      replace('shelves', shelfCount > 0 ? {
        kind: 'shelves', count: shelfAt?.length ?? shelfCount, shelfKind,
        ...(shelfInsets ? { insets: shelfInsets } : {}),
        ...(shelfAt && shelfAt.length > 0 ? { at: shelfAt } : {}),
      } : null)
    }
    if (next.standCount !== undefined) replace('stand', standCount > 0 ? { kind: 'stand', count: standCount } : null)
    if (next.filling !== undefined) replace('filling', next.filling ? { kind: 'filling', filling: next.filling } : null)
    if (next.hasRod !== undefined) replace('rod', hasRod ? { kind: 'rod' } : null)

    editSection(index, { contents }, 'section.fill')
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-neutral-500">{tr('Секция')} {index + 1}</span>
        <Button onClick={() => removeSection(index)} disabled={!canRemove} title={tr('Удалить секцию')}>
          ✕
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={tr('Ширина')}>
          <Select
            value={section.widthMode}
            onChange={(widthMode) =>
              editSection(
                index,
                widthMode === 'fixed'
                  ? { widthMode, width: computedWidth ?? section.width ?? 400 }
                  : { widthMode, width: undefined },
                'section.widthMode',
              )
            }
            options={[
              { value: 'flex', label: tr('Гибкая (делит остаток)') },
              { value: 'fixed', label: tr('Фиксированная') },
            ]}
          />
        </Field>
        <Field label={`${tr('Ширина')} (W), ${tr('мм')}`} hint={section.widthMode === 'flex' ? tr('Рассчитывается') : undefined}>
          {section.widthMode === 'flex' ? (
            <input type="text" readOnly aria-label={`${tr('Ширина')} (W), ${tr('мм')}`}
              value={computedWidth ?? '—'}
              className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-1.5 py-1 text-center text-xs tabular-nums text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300" />
          ) : (
            <NumberInput value={section.width ?? 0} min={100} step={1} buttonStep={10}
              invalid={invalidField === `sections[${index}].width` || invalidField === `sections[${index}]`}
              field={`sections[${index}].width`} onDraftValidityChange={onDraftValidityChange}
              onChange={(width) => editSection(index, { width }, 'section.width')} />
          )}
        </Field>
      </div>

      {shelves?.kind === 'shelves' && shelves.count > 0 ? (
        <div className="space-y-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">{tr('Полки: отступы и высоты')}</div>
          <div className="grid grid-cols-4 gap-2">
            {([['left', 'Слева'], ['right', 'Справа'], ['front', 'Спереди'], ['back', 'Сзади']] as const)
              .map(([key, label]) => (
                <Field key={key} label={tr(label)}>
                  <NumberInput
                    value={shelves.insets?.[key] ?? 0}
                    min={0}
                    max={1000}
                    onChange={(value) => setFill({ shelfInsets: { ...shelves.insets, [key]: value } })}
                  />
                </Field>
              ))}
          </div>
          {/*
            * Нақты биіктіктер: бос болса — тең таратылады. Үтірмен енгізу
            * цехқа ыңғайлы: «320, 700, 1150» деп бір жолмен қояды.
            */}
          <Field label={tr('Высоты полок, мм')} hint={tr('через запятую; пусто — поровну')}>
            <input
              value={heightsDraft}
              aria-invalid={heightsError || undefined}
              aria-describedby={heightsError ? `shelf-at-error-${section.id}` : undefined}
              onChange={(e) => {
                const raw = e.target.value
                setHeightsDraft(raw)
                const parsed = parseShelfHeights(raw, cabinetHeight)
                setHeightsError(Boolean(parsed.error))
                onDraftValidityChange?.(shelfAtField, Boolean(parsed.error))
                const change = shelfHeightsChange(raw, shelves.at?.length ?? shelves.count, cabinetHeight)
                if (change) setFill({ shelfCount: change.count, shelfAt: change.at ?? null })
              }}
              placeholder="320, 700, 1150"
              className={cn('w-full rounded-md border bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-neutral-900 dark:bg-neutral-900', heightsError ? 'border-red-500 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-700')}
            />
            {heightsError ? <span id={`shelf-at-error-${section.id}`} role="alert" className="mt-1 block text-[11px] text-red-700 dark:text-red-400">
              {shelfAtField}: {tr('Введите целые высоты полок')} — {tr('допустимо')} 1..{cabinetHeight} {tr('мм')}, 1..20 {tr('значений')}
            </span> : null}
          </Field>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={tr('Полок')}>
          <NumberInput
            value={shelves?.at?.length ?? shelves?.count ?? 0}
            min={0}
            max={20}
            field={`sections[${index}].contents[${Math.max(shelfContentIndex, 0)}].count`}
            onDraftValidityChange={onDraftValidityChange}
            onChange={(count) => {
              const change = shelfCountChange(count, shelves?.at?.length ?? shelves?.count ?? 0, shelves?.at)
              setHeightsDraft((change.at ?? []).join(', '))
              setHeightsError(false)
              onDraftValidityChange?.(shelfAtField, false)
              setFill({ shelfCount: change.count, shelfAt: change.at ?? null })
            }}
          />
        </Field>
        <Field label={tr('Тип полки')}>
          <Select
            value={shelves?.shelfKind ?? 'adjustable'}
            onChange={(shelfKind) => setFill({ shelfKind })}
            options={[
              { value: 'adjustable', label: tr('На полкодержателях') },
              { value: 'fixed', label: tr('Фиксированная') },
            ]}
          />
        </Field>
        <Field label={tr('Стоек')} hint={tr('вертикальные, в полосе')}>
          <NumberInput
            value={stand?.kind === 'stand' ? stand.count : 0}
            min={0}
            max={10}
            onChange={(standCount) => setFill({ standCount })}
          />
        </Field>
        <Field label={tr('Ящиков')} hint={drawers ? 'снизу' : undefined}>
          <NumberInput
            value={drawers?.count ?? 0}
            min={0}
            max={8}
            field={`sections[${index}].contents[${Math.max(drawerContentIndex, 0)}].count`}
            onDraftValidityChange={onDraftValidityChange}
            onChange={(drawerCount) => setFill({ drawerCount })}
          />
        </Field>
        <Field label={tr('Штанга')} hint={rod ? 'сверху' : undefined}>
          <div className="pt-1.5">
            <Toggle
              checked={rod !== undefined}
              onChange={(hasRod) => setFill({ hasRod })}
              label={tr('для одежды')}
            />
          </div>
        </Field>
        <Field label={tr('Высота ящиков')} hint={drawers?.height ? 'мм' : 'делит поровну'}>
          <NumberInput
            value={drawers?.height ?? 0}
            min={0}
            step={10}
            field={`sections[${index}].contents[${Math.max(drawerContentIndex, 0)}].height`}
            onDraftValidityChange={onDraftValidityChange}
            onChange={(height) => {
              if (!drawers) return
              const contents = section.contents.map((c) =>
                c.kind === 'drawers' ? { ...c, ...(height > 0 ? { height } : { height: undefined }) } : c,
              )
              editSection(index, { contents }, 'section.drawerHeight')
            }}
          />
        </Field>
      </div>

      {/* Ящиктің САҢЫЛАУЛАРЫ мен ЖАНАМА ПЛАНКАЛАРЫ — тек ящик бар секцияда.
          qdesign-де де осы екеуі ящиктің өз терезесінде тұр. */}
      {drawers ? (
        <>
          <div className="grid grid-cols-5 gap-1">
            {([
              ['between', 'Между'],
              ['left', 'Слева'],
              ['right', 'Справа'],
              ['top', 'Сверху'],
              ['bottom', 'Снизу'],
            ] as const).map(([key, label]) => (
              <Field key={key} label={tr(label)} hint={key === 'between' ? tr('зазоры, мм') : undefined}>
                <NumberInput
                  value={drawers.gaps?.[key] ?? shopGap}
                  min={0}
                  max={50}
                  field={`sections[${index}].contents[${drawerContentIndex}].gaps.${key}`}
                  onDraftValidityChange={onDraftValidityChange}
                  onChange={(value) => {
                    const contents = section.contents.map((c) =>
                      c.kind === 'drawers'
                        ? { ...c, gaps: { ...c.gaps, [key]: value } }
                        : c)
                    editSection(index, { contents }, `section.drawerGap.${key}`)
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label={tr('Фасад ящика')} hint={tr('вкладной сидит в нише')}>
            <Select
              value={drawers.frontMount ?? 'overlay'}
              onChange={(frontMount) => {
                const contents = section.contents.map((c) =>
                  c.kind === 'drawers' ? { ...c, frontMount } : c)
                editSection(index, { contents }, 'section.drawerFrontMount')
              }}
              options={[
                { value: 'overlay' as const, label: tr('Накладной') },
                { value: 'inset' as const, label: tr('Вкладной') },
              ]}
            />
          </Field>
          <HandleFields
            label={tr('Ручка ящика')}
            field="section.drawerHandle"
            value={drawers.handle}
            onChange={(handle, field) => {
              const contents = section.contents.map((c) => (c.kind === 'drawers' ? { ...c, handle } : c))
              editSection(index, { contents }, field)
            }}
          />
          {fillerStep === null ? <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            {tr('Материал корпуса не найден')}: {cabinet.carcassMaterialId}
          </p> : <div className="grid grid-cols-2 gap-2">
            {([['left', 'Планка слева'], ['right', 'Планка справа']] as const).map(([side, label]) => (
              <Field key={side} label={tr(label)} hint={tr('сужает нишу, мм')}>
                <NumberInput
                  value={drawers.fillers?.[side] ?? 0}
                  min={0}
                  max={200}
                  step={fillerStep}
                  invalid={invalidField === `sections[${index}].contents[${drawerContentIndex}].fillers.${side}`}
                  field={`sections[${index}].contents[${drawerContentIndex}].fillers.${side}`}
                  onDraftValidityChange={onDraftValidityChange}
                  onChange={(value) => {
                    const contents = section.contents.map((c) =>
                      c.kind === 'drawers'
                        ? { ...c, fillers: { ...c.fillers, [side]: value } }
                        : c)
                    editSection(index, { contents }, `section.drawerFiller.${side}`)
                  }}
                />
              </Field>
            ))}
          </div>}
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={tr('Наполнение')}>
          <Select
            value={filling?.kind === 'filling' ? filling.filling : 'none'}
            onChange={(v) => setFill({ filling: v === 'none' ? null : (v as FillingKind) })}
            options={[
              { value: 'none', label: tr('— Нет —') },
              ...FILLINGS.map((f) => ({ value: f.id, label: f.name })),
            ]}
          />
        </Field>
        <Field label={tr('Техника')}>
          <Select
            value={appliance?.kind === 'appliance' ? appliance.appliance : 'none'}
            onChange={(v) => setFill({ appliance: v === 'none' ? null : (v as ApplianceKind) })}
            options={[
              { value: 'none', label: tr('— Нет —') },
              ...APPLIANCES.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </Field>
      </div>

      {section.contents.map((content, contentIndex) => {
        if (content.kind !== 'appliance') return null
        const model = APPLIANCE_NICHE_MODELS.find((candidate) => candidate.id === content.modelId)
        const models = APPLIANCE_NICHE_MODELS.filter((candidate) => candidate.appliance === content.appliance)
        const change = (replacement: SectionContent) => editSection(index,
          { contents: updateSectionContentAt(section.contents, contentIndex, replacement) }, 'section.appliance')
        return <div key={`${section.id}-appliance-${contentIndex}`} className="space-y-2 border border-neutral-200 p-2 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2 text-xs font-medium">
            <span>{tr('Техника')} {contentIndex + 1}: {tr(APPLIANCES.find((item) => item.id === content.appliance)?.name ?? content.appliance)}</span>
            {section.contents.filter((item) => item.kind === 'appliance').length > 1 &&
              <Button size="sm" onClick={() => editSection(index,
                { contents: removeSectionContentAt(section.contents, contentIndex) }, 'section.appliance')}>
                {tr('Удалить технику')}
              </Button>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label={tr('Тип техники')}>
              <Select value={content.appliance} onChange={(appliance) => change({ kind: 'appliance', appliance, height: content.height })}
                options={APPLIANCES.map((item) => ({ value: item.id, label: tr(item.name) }))} />
            </Field>
            <Field label={tr('Артикул')}>
              <Select value={content.modelId ?? ''} onChange={(modelId) => change({ ...content, modelId: modelId || undefined })}
                options={[{ value: '', label: tr('Не указан') }, ...models.map((item) => ({ value: item.id, label: item.article }))]} />
            </Field>
            <Field label={`${tr('Высота ниши')} (H), ${tr('мм')}`}>
              <NumberInput value={content.height ?? 0} min={0} max={cabinetHeight} step={1}
                field={`sections[${index}].contents[${contentIndex}].height`}
                onDraftValidityChange={onDraftValidityChange}
                onChange={(height) => change({ ...content, height: height || undefined })} />
            </Field>
          </div>
          {model && <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
            {tr('Требование к нише')}: {model.height.min}{model.height.max !== undefined ? `..${model.height.max}` : '+'} (H) ×{' '}
            {model.width.min}{model.width.max !== undefined ? `..${model.width.max}` : '+'} (W) × ≥{model.depthMin} (D) {tr('мм')}
          </p>}
          {!model && <p className="text-[11px] text-amber-700 dark:text-amber-300">{tr('Размеры техники без артикула не подтверждены')}</p>}
        </div>
      })}
      {appliance && <Field label={tr('Добавить технику')}>
        <Select value="" onChange={(kind) => {
          if (!kind) return
          editSection(index, { contents: [...section.contents, { kind: 'appliance', appliance: kind as ApplianceKind }] }, 'section.appliance')
        }} options={[{ value: '', label: tr('Выберите тип') }, ...APPLIANCES.map((item) => ({ value: item.id, label: tr(item.name) }))]} />
      </Field>}

      <div className="grid grid-cols-2 gap-2">
        <Field label={tr('Фасадов')}>
          <NumberInput
            value={section.fronts?.count ?? 0}
            min={0}
            max={8}
            invalid={frontError?.control === 'section.fronts'}
            field={`${frontDraftField}.count`}
            onDraftValidityChange={onDraftValidityChange}
            onChange={(count) => editFronts({ count }, 'section.fronts')}
          />
        </Field>
        <Field label={tr('Тип фасада')}>
          <Select
            value={section.fronts?.mount ?? 'overlay'}
            invalid={frontError?.control === 'section.frontMount'}
            onChange={(mount) => editFronts({ mount }, 'section.frontMount')}
            options={[
              { value: 'overlay', label: tr('Накладной') },
              { value: 'inset', label: tr('Вкладной') },
            ]}
          />
        </Field>
      </div>

      {frontError ? (
        <div role="alert" className="border border-red-500 p-2 text-[11px] text-red-700 dark:text-red-400">
          <b>{frontError.field}</b>: {tr(frontError.message.replace(`${frontError.field}: `, ''))}
          {frontError.allowed ? ` — ${frontError.allowed}` : null}
          {frontError.field.endsWith('.opening') ? ` ${tr('Добавьте отдельную секцию для каждой двери.')}` : null}
          {frontError.field.endsWith('.hingeSystemId') ? (
            <button type="button" className="ml-1 underline" onClick={() => setShopOpen(true)}>{tr('Открыть настройки цеха')}</button>
          ) : null}
        </div>
      ) : null}

      {/* СЕКЦИЯ ФАСАДЫНЫҢ ДЕКОРЫ — корпустан бөлек (qdesign сияқты: бір
          шкафта әр есік әртүрлі түсте). Берілмесе — корпустікі. */}
      {section.fronts && section.fronts.count > 0 ? (
        <Field
          label={tr('Декор фасада секции')}
          hint={section.fronts.materialId ? tr('свой') : tr('как у корпуса')}
        >
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <DecorPicker
                materials={sectionFrontMats}
                value={section.fronts.materialId ?? cabFrontMat}
                onChange={(materialId) =>
                  editFronts({ materialId }, 'section.frontMaterial')
                }
              />
            </div>
            {section.fronts.materialId ? (
              <button
                type="button"
                title={tr('Вернуть декор корпуса')}
                onClick={() =>
                  editFronts({ materialId: undefined }, 'section.frontMaterial')
                }
                className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                ↺
              </button>
            ) : null}
          </div>
        </Field>
      ) : null}

      {section.fronts ? (
        <FrontFittings
          fronts={section.fronts}
          onChange={editFronts}
          fieldPrefix={frontDraftField}
          invalidControl={frontError?.control}
          onDraftValidityChange={onDraftValidityChange}
        />
      ) : null}
    </div>
  )
}

/**
 * Тұтқаның баптауы: моделі, аралығы, орны, шегіністері.
 *
 * Ілмелі фасад пен ящиктің фасады БІР компонентті қолданады — ядрода да
 * екеуі бір ережемен (`handleBorePoints`) бұрғыланады.
 */
function HandleFields({
  value, onChange, field, label, invalidControl, draftPrefix, onDraftValidityChange,
}: {
  /** undefined — цехтың әдепкісі, null — әдейі тұтқасыз. */
  value: HandleSpec | null | undefined
  onChange: (handle: HandleSpec | null, field: string) => void
  /** Өрістің аты (қате жолағы үшін); баптаулары `${field}Bore` т.с.с. */
  field: string
  label: string
  invalidControl?: string | undefined
  draftPrefix?: string | undefined
  onDraftValidityChange?: ((field: string, invalid: boolean) => void) | undefined
}) {
  const handles = useConfigurator((s) => s.shop.handles)
  const handleSpec: HandleSpec | null = value === null ? null : value ?? defaultHandleSpec()
  const model = handleSpec ? handles.find((h) => h.id === handleSpec.handleId) : undefined
  const spacings = model?.boreSpacings ?? []
  // Профильде тесік жоқ, бірақ ҚАЙ ЖИЕКТЕ тұратыны бәрібір керек.
  const drilled = model !== undefined && model.kind !== 'profile' && model.kind !== 'none'

  const setHandle = (patch: Partial<HandleSpec>, suffix: string) => {
    if (!handleSpec) return
    onChange({ ...handleSpec, ...patch }, `${field}${suffix}`)
  }

  return (
    <>
      <Field label={label}>
        <Select
          value={handleSpec ? handleSpec.handleId : 'none'}
          onChange={(id) =>
            onChange(id === 'none' ? null : { ...(handleSpec ?? defaultHandleSpec()), handleId: id }, field)
          }
          options={[
            ...handles.map((h) => ({ value: h.id, label: h.name })),
            { value: 'none', label: tr('— Без ручки —') },
          ]}
        />
      </Field>

      {handleSpec && model && model.kind !== 'none' ? (
        <div className="grid grid-cols-2 gap-2">
          {spacings.length > 0 ? (
            <Field label={tr('Межцентровое, мм')}>
              <Select
                value={String(handleSpec.boreSpacing)}
                onChange={(v) => setHandle({ boreSpacing: Number(v) }, 'Bore')}
                options={spacings.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </Field>
          ) : null}
          <Field label={tr('Расположение')}>
            <Select
              value={handleSpec.position}
              onChange={(position) => setHandle({ position: position as HandleSpec['position'] }, 'Position')}
              options={HANDLE_POSITIONS.map((p) => ({ value: p, label: handlePositionName(p) }))}
            />
          </Field>
          {drilled ? (
            <>
              <Field label={tr('Отступ от края, мм')}>
                <NumberInput
                  value={handleSpec.edgeOffset}
                  min={0}
                  invalid={invalidControl === `${field}EdgeOffset`}
                  {...(draftPrefix ? { field: `${draftPrefix}.edgeOffset` } : {})}
                  onDraftValidityChange={onDraftValidityChange}
                  onChange={(edgeOffset) => setHandle({ edgeOffset }, 'EdgeOffset')}
                />
              </Field>
              <Field label={tr('Отступ от торца, мм')}>
                <NumberInput
                  value={handleSpec.endOffset}
                  min={0}
                  invalid={invalidControl === `${field}EndOffset`}
                  {...(draftPrefix ? { field: `${draftPrefix}.endOffset` } : {})}
                  onDraftValidityChange={onDraftValidityChange}
                  onChange={(endOffset) => setHandle({ endOffset }, 'EndOffset')}
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/**
 * Фасадтың фурнитурасы: ілгек жүйесі мен тұтқа.
 *
 * Каталог ЦЕХТІКІ (`shop.hingeSystems` / `shop.handles`), сондықтан мұнда
 * тізім ойдан жасалмайды — цех қандай бренд қосса, сол көрінеді.
 */
function FrontFittings({
  fronts,
  onChange,
  fieldPrefix,
  invalidControl,
  onDraftValidityChange,
}: {
  fronts: SectionFronts
  onChange: (patch: Partial<SectionFronts>, field: string) => void
  fieldPrefix: string
  invalidControl?: string | undefined
  onDraftValidityChange?: ((field: string, invalid: boolean) => void) | undefined
}) {
  const shop = useConfigurator((s) => s.shop)
  const setShopOpen = useConfigurator((s) => s.setShopOpen)
  const systems = shop.hingeSystems
  const matchingSystems = compatibleHinges(systems, fronts.mount)
  const selectedHinge = fronts.hingeSystemId ?? matchingSystems[0]?.id ?? ''
  const hingeId = matchingSystems.some((system) => system.id === selectedHinge) ? selectedHinge : ''

  const milling: MillingSpec | null = fronts.milling ?? null
  const pattern = milling ? millingPattern(milling.patternId) : null
  const setMilling = (patch: Partial<MillingSpec>, field: string) => {
    if (!milling) return
    onChange({ milling: { ...milling, ...patch } }, field)
  }

  /** SVG файлды мәтін күйінде оқимыз: ядро оны өзі талдайды. */
  const readSvg = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setMilling({ svg: String(reader.result ?? '') }, 'section.millingSvg')
    reader.readAsText(file)
  }

  const gaps = fronts.gaps ?? {}
  const setGap = (key: keyof NonNullable<SectionFronts['gaps']>, value: number) =>
    onChange({ gaps: { ...gaps, [key]: value } }, `section.frontGap.${key}`)
  const shopGap = shop.settings.frontGap ?? DEFAULT_SETTINGS.frontGap

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
      <Field label={tr('Открывание')} hint={tr('сторона петель')}>
        <Select
          value={fronts.opening ?? 'auto'}
          invalid={invalidControl === 'section.opening'}
          onChange={(opening) => onChange({ opening }, 'section.opening')}
          options={[
            { value: 'auto' as const, label: tr('Автоматически') },
            { value: 'left' as const, label: tr('Все влево') },
            { value: 'right' as const, label: tr('Все вправо') },
            // Көтерілетін фасад: ұяда жалғыз, присадкасы шаблон бойынша.
            { value: 'up' as const, label: tr('Вверх (подъёмный)') },
          ]}
        />
      </Field>

      {fronts.opening === 'up' ? (
        <p className="text-[11px] leading-snug text-neutral-500">
          {tr('Присадка подъёмника не ставится: её сверлят по бумажному шаблону механизма. Механизм попадает в смету, в деталировке фасада есть пометка.')}
        </p>
      ) : null}

      {/* Зазорлар: бос өріс = цехтың әдепкісі. Ас үй қатарында олар шынымен
          әртүрлі болады, сондықтан әр жағы бөлек. */}
      <div className="grid grid-cols-3 gap-2">
        {([
          ['between', 'Между'],
          ['left', 'Слева'],
          ['right', 'Справа'],
          ['top', 'Сверху'],
          ['bottom', 'Снизу'],
        ] as const).map(([key, label]) => (
          <Field key={key} label={tr(label)} hint={gaps[key] === undefined ? `${shopGap}` : undefined}>
            <NumberInput
              value={gaps[key] ?? shopGap}
              min={0}
              max={50}
              invalid={invalidControl === `section.frontGap.${key}`}
              field={`${fieldPrefix}.gaps.${key}`}
              onDraftValidityChange={onDraftValidityChange}
              onChange={(v) => setGap(key, v)}
            />
          </Field>
        ))}
      </div>

      <Field label={tr('Фрезеровка')}>
        <Select
          value={milling?.patternId ?? 'plain'}
          onChange={(id) =>
            onChange(
              { milling: id === 'plain' ? null : { ...(milling ?? defaultMillingSpec()), patternId: id } },
              'section.milling',
            )
          }
          options={MILLING_PATTERNS.map((p) => ({ value: p.id, label: p.name }))}
        />
      </Field>

      {milling ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Глубина, мм')}>
            <NumberInput
              value={milling.depth}
              min={1}
              max={20}
              onChange={(depth) => setMilling({ depth }, 'section.millingDepth')}
            />
          </Field>
          {pattern?.usesInset ? (
            <Field label={tr('Отступ от края, мм')}>
              <NumberInput
                value={milling.inset}
                min={0}
                step={5}
                onChange={(inset) => setMilling({ inset }, 'section.millingInset')}
              />
            </Field>
          ) : null}
          {pattern?.usesCount ? (
            <Field label={tr('Количество')}>
              <NumberInput
                value={milling.count}
                min={1}
                max={24}
                onChange={(count) => setMilling({ count }, 'section.millingCount')}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {milling?.patternId === 'custom' ? (
        <Field label={tr('Файл SVG')}>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".svg,image/svg+xml"
              onChange={(e) => readSvg(e.target.files?.[0])}
              className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-neutral-200 file:px-2 file:py-1 file:text-xs dark:file:bg-neutral-800 dark:file:text-neutral-200"
            />
            <span className="whitespace-nowrap text-[11px] text-neutral-500">
              {milling.svg ? 'загружен' : 'не выбран'}
            </span>
          </div>
        </Field>
      ) : null}

      <Field label={tr('Петля')}>
        <Select
          value={hingeId}
          invalid={invalidControl === 'section.hinge'}
          disabled={matchingSystems.length === 0}
          onChange={(hingeSystemId) => onChange({ hingeSystemId }, 'section.hinge')}
          options={[
            ...(hingeId ? [] : [{ value: '', label: tr('Выберите подходящую петлю'), disabled: true }]),
            ...matchingSystems.map((h) => ({ value: h.id, label: h.name })),
          ]}
        />
      </Field>
      {matchingSystems.length === 0 ? (
        <p role="alert" className="border border-red-500 p-2 text-[11px] text-red-700 dark:text-red-400">
          {tr('В каталоге цеха нет петли для этого типа фасада. Добавьте артикул в настройках цеха.')}
          <button type="button" className="ml-1 underline" onClick={() => setShopOpen(true)}>{tr('Открыть настройки цеха')}</button>
        </p>
      ) : null}

      <HandleFields
        label={tr('Ручка')}
        field="section.handle"
        invalidControl={invalidControl}
        draftPrefix={`${fieldPrefix}.handle`}
        onDraftValidityChange={onDraftValidityChange}
        value={fronts.handle}
        onChange={(handle, field) => onChange({ handle }, field)}
      />
    </div>
  )
}

/**
 * Корпустағы ТЕХНИКА: мойка, варочная панель, сорғыш. Клиенттікі —
 * сметаға кірмейді, тек 3D-де және «техника клиента» тізімінде көрінеді.
 */
function FixtureFields({ onDraftValidityChange }: {
  onDraftValidityChange?: ((field: string, invalid: boolean) => void) | undefined
}) {
  const cabinet = useConfigurator(activeCabinet)
  const edit = useConfigurator((s) => s.edit)
  const fixtures = cabinet.fixtures ?? []
  const set = (next: CabinetFixture[], field: string) =>
    edit(field, { fixtures: next.length > 0 ? next : undefined })
  const without = (kind: CabinetFixture['kind']) => fixtures.filter((f) => f.kind !== kind)
  const has = (kind: CabinetFixture['kind']) => fixtures.some((f) => f.kind === kind)
  const hob = fixtures.find((f) => f.kind === 'hob')
  const sink = fixtures.find((f) => f.kind === 'sink')
  const yesNo = [{ value: 'no', label: tr('Нет') }, { value: 'yes', label: tr('Есть') }]
  const sinkDisabled = fixtureChoiceDisabled(fixtures, 'sink', Boolean(cabinet.worktop))
  const hobDisabled = fixtureChoiceDisabled(fixtures, 'hob', Boolean(cabinet.worktop))
  const changeFixture = (kind: 'sink' | 'hob', patch: { modelId?: string | undefined; frontInset?: number | undefined }) => {
    const fixtureIndex = fixtures.findIndex((fixture) => fixture.kind === kind)
    const existing = fixtures[fixtureIndex]
    if (!existing || existing.kind !== kind) return
    set(updateFixtureAt(fixtures, fixtureIndex, { ...existing, ...patch }), `fixtures.${kind}`)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Field label={tr('Мойка')}>
        <Select
          value={has('sink') ? 'yes' : 'no'}
          onChange={(v) => set(v === 'yes' ? [...without('sink'), { kind: 'sink' }] : without('sink'), 'fixtures.sink')}
          options={yesNo.map((option) => ({ ...option, disabled: option.value === 'yes' && sinkDisabled }))}
        />
      </Field>
      <Field label={tr('Варочная панель')}>
        <Select
          value={hob?.kind === 'hob' ? hob.fuel : 'none'}
          onChange={(v) => set(v === 'none' ? without('hob') : [...without('hob'), { ...(hob?.kind === 'hob' ? hob : {}), kind: 'hob', fuel: v }], 'fixtures.hob')}
          options={[
            { value: 'none' as const, label: tr('Нет') },
            { value: 'gas' as const, label: tr('Газовая'), disabled: hobDisabled },
            { value: 'electric' as const, label: tr('Электрическая'), disabled: hobDisabled },
          ]}
        />
      </Field>
      <Field label={tr('Вытяжка')}>
        <Select
          value={has('hood') ? 'yes' : 'no'}
          onChange={(v) => set(v === 'yes' ? [...without('hood'), { kind: 'hood' }] : without('hood'), 'fixtures.hood')}
          options={yesNo}
        />
      </Field>
      {([sink, hob] as const).map((fixture) => {
        if (!fixture) return null
        const kind = fixture.kind
        const selectedId = fixture.modelId ?? (kind === 'hob' ? 'hob-60-default' : '')
        const model = WORKTOP_FIXTURE_MODELS.find((candidate) => candidate.id === selectedId)
        const fixtureIndex = fixtures.findIndex((candidate) => candidate.kind === kind)
        return <div key={kind} className="col-span-3 grid grid-cols-1 gap-2 border border-neutral-200 p-2 dark:border-neutral-800 sm:grid-cols-2">
          <Field label={`${tr(kind === 'sink' ? 'Мойка' : 'Варочная панель')}: ${tr('Артикул')}`}>
            <Select value={selectedId} onChange={(modelId) => changeFixture(kind, { modelId: modelId || undefined })}
              options={[{ value: '', label: tr('Не указан') }, ...WORKTOP_FIXTURE_MODELS.filter((candidate) => candidate.kind === kind)
                .map((candidate) => ({ value: candidate.id, label: candidate.article }))]} />
          </Field>
          <Field label={`${tr('Отступ выреза спереди')}, ${tr('мм')}`} hint={model?.minFront === undefined ? undefined : `≥ ${model.minFront}`}>
            <NumberInput value={fixture.frontInset ?? model?.minFront ?? 0} min={0} step={1}
              field={`fixtures[${fixtureIndex}].frontInset`}
              onDraftValidityChange={onDraftValidityChange}
              onChange={(frontInset) => changeFixture(kind, { frontInset })} />
          </Field>
          {model ? <p className="text-[11px] text-neutral-600 dark:text-neutral-300 sm:col-span-2">
            {tr('Вырез')}: {model.width} (W) × {model.depth} (D) {tr('мм')}
            {model.radius === undefined ? '' : ` · R${model.radius}`}
          </p> : <p className="text-[11px] text-amber-700 dark:text-amber-300 sm:col-span-2">
            {tr('Без артикула вырез мойки не создаётся')}
          </p>}
        </div>
      })}
      {(sinkDisabled || hobDisabled) && <p className="col-span-3 text-[11px] text-neutral-600 dark:text-neutral-300">
        {cabinet.worktop ? tr('Мойка и варочная панель не помещаются в одном модуле') : tr('Для мойки или плиты добавьте столешницу')}
      </p>}
    </div>
  )
}

/** Өлшемнің осі → цех профиліндегі өріс аты. */
const AXIS_MIN = { height: 'minHeight', width: 'minWidth', depth: 'minDepth' } as const
const AXIS_MAX = { height: 'maxHeight', width: 'maxWidth', depth: 'maxDepth' } as const

/**
 * PRO100 v7.08-дің үш қосымшасы және біздің өндірістік төртінші қосымша.
 */
type Tab = 'general' | 'material' | 'reports' | 'production'

const tabButtonCls = 'flex-1 min-w-[5.5rem]'

export function Configurator({ invalidField, panels, onDraftValidityChange }: { invalidField: string | null; panels: Panel[]; onDraftValidityChange?: (field: string, invalid: boolean) => void }) {
  const cabinet: CabinetConfig = useConfigurator(activeCabinet)
  const edit = useConfigurator((s) => s.edit)
  const [nameError, setNameError] = useState<string | null>(null)
  const [name, setName] = useState(cabinet.name)
  useEffect(() => setName(cabinet.name), [cabinet.id, cabinet.name])
  const addSection = useConfigurator((s) => s.addSection)
  const [sectionAddError, setSectionAddError] = useState<string | null>(null)
  useEffect(() => setSectionAddError(null), [cabinet])
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const setGalleryOpen = useConfigurator((s) => s.setGalleryOpen)
  // Материалдар тізімі цехтың профилінен келеді, кодтан емес.
  const materials = useConfigurator((s) => s.shop.materials)
  const projectSettings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const limits = useConfigurator((s) => s.shop.limits)
  const carcassMaterials = materials.filter(isCarcass)
  const backMaterials = materials.filter((m) => !isCarcass(m))
  const catalog: Catalog = useConfigurator((s) => s.catalog)
  const computedSectionWidths = useMemo(() => {
    try { return sectionWidths(cabinet, catalog) }
    catch (cause) {
      if (!(cause instanceof ConfigValidationError)) throw cause
      return []
    }
  }, [cabinet, catalog])
  const cabinets = useConfigurator((s) => s.cabinets)
  const template = useMemo(() => findTemplate(matchTemplateId(cabinets, cabinet.id, catalog)), [cabinets, cabinet.id, catalog])

  // «Общее» қосымшасындағы модульдің бөлмедегі орны. Бұрын Workspace.tsx-те
  // Configurator-дан ТЫС тұратын, енді — PRO100-дың «бәрі бір терезеде»
  // идеясы бойынша осында (ProjectPanel.tsx-тегі «Реквизиты» қосымшасы
  // сияқты, дерек көзі — сол бір global store).
  const room = useConfigurator((s) => s.room)
  const root = useConfigurator((s) => s.root)
  const activeId = useConfigurator((s) => s.activeId)
  const movePlacement = useConfigurator((s) => s.movePlacement)
  const translateNodes = useConfigurator((s) => s.translateNodes)
  // Еркін тұрған шкафтың placement-і тек жуықтау: оны өзгертсек, шкаф
  // қабырғаға секіреді, сондықтан өрістер тек қабырғадағы шкафқа көрсетіледі.
  const activePlacement = useMemo(() => wallAttachedPlacements(root, room)
    .find((p) => p.cabinetId === activeId), [root, room, activeId])
  const freePosition = useMemo(() => {
    let position: { x: number; y: number; z: number } | null = null
    walkTree(root, (node, pose) => { if (node.id === activeId) position = pose.position })
    return position
  }, [root, activeId])

  // «Производство» қосымшасының батырмалары — присадка мен смета өз
  // терезелерінде қалады (қайта жазылмайды), мұнда тек ашатын жол.
  const setQuoteOpen = useConfigurator((s) => s.setQuoteOpen)
  const setDrillOpen = useConfigurator((s) => s.setDrillOpen)

  /* General ашық тұрады: Tour өлшем мен секцияларды осы табта көрсетеді. */
  const [tab, setTab] = useState<Tab>('general')

  // «Расчёт» қосымшасының қысқаша деталировкасы: толық кесте — астыңғы
  // CutListTable-де, толық баға — «Смета и раскрой» терезесінде; мұнда тек
  // көз алдында тұратын үзінді. Ядро функциясы қайта жазылмайды, солай
  // шақырылады (`formatCutList`) — материал өтпелі күйде табылмаса, бос тізім.
  const cutRows = useMemo(() => {
    try {
      return formatCutList(panels, catalog)
    } catch {
      return []
    }
  }, [panels, catalog])
  const CUT_SNIPPET_LIMIT = 6

  const invalid = (field: string) => invalidField === field
  const dimensionGuide = (axis: 'height' | 'width' | 'depth') =>
    dimensionRangeHint(template?.range[axis] ?? null, limits[AXIS_MIN[axis]], limits[AXIS_MAX[axis]])
  const hint = (axis: 'height' | 'width' | 'depth') => {
    const guide = dimensionGuide(axis)
    return guide.recommended ? `${tr('Рекомендуется')}: ${guide.recommended}`
      : guide.shop ? `${tr('Ориентир цеха')}: ${guide.shop}` : undefined
  }

  return (
    <div className="space-y-3">
      {/*
        PRO100-дың Properties терезесі: бір панель, үш эталон қосымша және
        біздің өндіріске арналған төртінші қосымша. Ауысу тек
        КЛАСС арқылы (Collapsible-дегі гочамен бірдей себеп): жасырын
        қосымшаның мазмұны DOM-да қалуы керек, әйтпесе беттен іздеу мен e2e
        оны таппайды (docs/pro100/ui-design.md).
      */}
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800" data-tour="tabs">
        <Button active={tab === 'general'} onClick={() => setTab('general')}><span className={tabButtonCls}>{tr('Общее')}</span></Button>
        <Button active={tab === 'material'} onClick={() => setTab('material')}><span className={tabButtonCls}>{tr('Материал')}</span></Button>
        <Button active={tab === 'reports'} onClick={() => setTab('reports')}><span className={tabButtonCls}>{tr('Отчёты')}</span></Button>
        <Button active={tab === 'production'} onClick={() => setTab('production')}><span className={tabButtonCls}>{tr('Производство')}</span></Button>
      </div>

      {/* ═══ ОБЩЕЕ: аты, шаблон, орны бөлмеде, есік/фасад түрі ═══ */}
      <div className={cn('flex-col gap-3', tab === 'general' ? 'flex' : 'hidden')}>
        <Field label={tr('Название')}>
          <input data-properties-name className="w-full border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900" value={name}
            onChange={(event) => { setName(event.target.value); setNameError(null) }}
            onBlur={() => { if (name !== cabinet.name) setNameError(commitPropertiesName(activeId, name)) }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} />
        </Field>
        {nameError && <p role="alert" className="text-red-700">{tr(nameError)}</p>}
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>{tr('Шаблон')}</SectionTitle>
          <Button onClick={() => setGalleryOpen(true)}>{tr('Выбрать')}</Button>
        </div>
        <div className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs dark:border-neutral-800">
          <div className="font-medium">{template ? template.name: tr('Свой корпус')}</div>
          {template ? (
            <div className="mt-0.5 text-[11px] leading-snug text-neutral-400">{template.description}</div>
          ) : null}
        </div>

        {!activePlacement && freePosition ? (
          <Collapsible id="free-position" title={tr('Положение')} defaultOpen>
            <div className="grid grid-cols-3 gap-2">
              {(['x', 'y', 'z'] as const).map((axis) => <Field key={axis} label={`${axis.toUpperCase()}, мм`}>
                <NumberInput value={freePosition![axis]} onChange={(value) => translateNodes([{ id: activeId, delta: { x: 0, y: 0, z: 0, [axis]: value - freePosition![axis] } }])} />
              </Field>)}
            </div>
          </Collapsible>
        ) : null}
        {activePlacement ? (
          <Collapsible id="placement" title={tr('Положение в комнате')} defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <Field label={tr('Стена')}>
                <select
                  className="w-full rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  value={activePlacement.wall}
                  onChange={(e) => movePlacement(activeId, { wall: e.target.value as WallId })}
                >
                  {roomWalls(room).map((w) => (
                    <option key={w.id} value={w.id}>{w.label}</option>
                  ))}
                </select>
              </Field>
              <Field
                label={tr('Смещение')}
                hint={`0..${Math.max(0, wallById(room, activePlacement.wall).length - cabinet.width)}`}
              >
                <NumberInput
                  value={activePlacement.offset}
                  min={0}
                  step={10}
                  onChange={(offset) => movePlacement(activeId, { offset })}
                />
              </Field>
              <Field label={tr('От пола')} hint="мм">
                <NumberInput
                  value={activePlacement.elevation ?? 0}
                  min={0}
                  max={4000}
                  step={10}
                  onChange={(elevation) => movePlacement(activeId, { elevation })}
                />
              </Field>
              <Field label={tr('Поворот')} hint="°">
                <NumberInput
                  value={activePlacement.rotate ?? 0}
                  min={-180}
                  max={180}
                  step={5}
                  onChange={(rotate) => movePlacement(activeId, { rotate })}
                />
              </Field>
            </div>
          </Collapsible>
        ) : null}

        <Collapsible id="sliding" title={tr('Двери')} badge={cabinet.sliding ? `${cabinet.sliding.count}` : tr('нет')}>
        <Field
          label={tr('Двери-купе')}
          hint={cabinet.sliding ? 'вместо распашных' : 'нет'}
        >
          <Select
            value={String(cabinet.sliding?.count ?? 0)}
            onChange={(value) => {
              const count = Number(value)
              edit('sliding', count > 0
                ? {
                    sliding: { count },
                    // Купе мен ілмелі фасад бір корпуста болмайды.
                    sections: cabinet.sections.map((sec) => ({ ...sec, fronts: null })),
                  }
                : { sliding: undefined })
            }}
            options={[
              { value: '0', label: tr('Нет, распашные фасады') },
              { value: '2', label: tr('2 двери') },
              { value: '3', label: tr('3 двери') },
              { value: '4', label: tr('4 двери') },
            ]}
          />
        </Field>

        </Collapsible>
      </div>

      {/* ═══ РАЗМЕРЫ: H×W×D, конструкция, скос, угловой, фронт. панель, основание ═══ */}
      <div className={cn('flex-col gap-3', tab === 'general' ? 'flex' : 'hidden')}>
        <SectionTitle>{tr('Габарит — H × W × D, мм')}</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-tour="size">
          <Field label={tr('Высота (H)')} hint={hint('height')}>
            <NumberInput
              value={cabinet.height} min={CABINET_DIMENSION_MIN} max={CABINET_DIMENSION_MAX} step={10} invalid={invalid('cabinet.height')} field="cabinet.height" onDraftValidityChange={onDraftValidityChange}
              onChange={(height) => edit('height', { height })}
            />
          </Field>
          <Field label={tr('Ширина (W)')} hint={hint('width')}>
            <NumberInput
              value={cabinet.width} min={CABINET_DIMENSION_MIN} max={CABINET_DIMENSION_MAX} step={10} invalid={invalid('cabinet.width')} field="cabinet.width" onDraftValidityChange={onDraftValidityChange}
              onChange={(width) => edit('width', { width })}
            />
          </Field>
          <Field label={tr('Глубина (D)')} hint={hint('depth')}>
            <NumberInput
              value={cabinet.depth} min={CABINET_DIMENSION_MIN} max={CABINET_DIMENSION_MAX} step={10} invalid={invalid('cabinet.depth')} field="cabinet.depth" onDraftValidityChange={onDraftValidityChange}
              onChange={(depth) => edit('depth', { depth })}
            />
          </Field>
        </div>
        <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
          {tr('Обязательный диапазон габаритов')}: {dimensionGuide('height').allowed} {tr('мм')}.
          {(['height', 'width', 'depth'] as const).map((axis) => dimensionGuide(axis).shop
            ? ` ${tr(axis === 'height' ? 'Высота (H)' : axis === 'width' ? 'Ширина (W)' : 'Глубина (D)')}: ${tr('Ориентир цеха')} ${dimensionGuide(axis).shop}.`
            : '')}
        </p>

        <Collapsible id="construction" title={tr('Конструкция')} defaultOpen tour="sections">
        <Field label={tr('Метод сборки')} hint={tr('обе панели сразу')}>
          <Select
            value={cabinet.construction}
            onChange={(construction) =>
              // Жалпы әдіс екеуін де қатар ауыстырады: бұл — жиі керек болатын
              // жылдам таңдау. Бөлек-бөлек баптау төменде тұр.
              edit('construction', { construction, mounts: undefined })
            }
            options={[
              { value: 'sidesOverlay', label: tr('Боковины накрывают крышку и дно') },
              { value: 'topBottomOverlay', label: tr('Крышка и дно накрывают боковины') },
            ]}
          />
        </Field>

        {/* Элемент бойынша: қатарға тұратын модульдің крышкасы тек сыртқы
            бүйірді жабады, ал ішкі жағы көршісіне тіреледі.

            Крышканың тізімінде бекітілуден БӨЛЕК «Планка» мен «Нет» те тұр —
            үшеуі де бір сұрақтың жауабы («үстінде не бар?»), сондықтан бір
            тізімде. qdesign да дәл солай жасаған. */}
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Крышка')}>
            <Select
              value={cabinet.openTop ? 'none' : cabinet.topRails ? 'rails'
                : (cabinet.mounts?.top ?? (cabinet.construction === 'sidesOverlay' ? 'inset' : 'overlay'))}
              onChange={(value) => edit('mounts.top', value === 'rails'
                ? { openTop: undefined, topRails: cabinet.topRails ?? { width: 100, count: 2 } }
                : value === 'none'
                  ? { openTop: true, topRails: undefined }
                  : {
                    openTop: undefined,
                    topRails: undefined,
                    mounts: { ...cabinet.mounts, top: value },
                  })}
              options={[
                { value: 'inset' as const, label: tr('Вкладной') },
                { value: 'overlay' as const, label: tr('Накладной') },
                { value: 'overlayLeft' as const, label: tr('Накладной слева') },
                { value: 'overlayRight' as const, label: tr('Накладной справа') },
                { value: 'rails' as const, label: tr('Планка (царга)') },
                { value: 'none' as const, label: tr('Нет') },
              ]}
            />
          </Field>
          <Field label={tr('Дно')}>
            <Select
              value={cabinet.mounts?.bottom ?? (cabinet.construction === 'sidesOverlay' ? 'inset' : 'overlay')}
              onChange={(mount) => edit('mounts.bottom', {
                mounts: { ...cabinet.mounts, bottom: mount },
              })}
              options={[
                { value: 'inset' as const, label: tr('Вкладной') },
                { value: 'overlay' as const, label: tr('Накладной') },
                { value: 'overlayLeft' as const, label: tr('Накладной слева') },
                { value: 'overlayRight' as const, label: tr('Накладной справа') },
              ]}
            />
          </Field>
        </div>
        {/* Направляющаның жүйесі: саңылауы да, тесігі де, қораптың тереңдігі де
            содан шығады. «Цехтың профилінен» — ескі мінез. */}
        <Field label={tr('Направляющие')} hint={tr('размер короба зависит от них')}>
          <Select
            value={cabinet.drawerSystem ?? 'profile'}
            onChange={(value) => edit('drawerSystem', {
              drawerSystem: value === 'profile' ? undefined : value,
            })}
            options={[
              { value: 'profile' as const, label: tr('Из профиля цеха') },
              { value: 'roller' as const, label: tr('Роликовые (телескопические)') },
              { value: 'ball' as const, label: tr('Шариковые полного выдвижения') },
              { value: 'tandem' as const, label: tr('Blum TANDEM (скрытые)') },
              // Металл жәшік: қорап сатып алынады, парақтан түбі мен арты ғана.
              { value: 'legrabox' as const, label: tr('Blum LEGRABOX (металлический ящик)') },
              { value: 'tandembox' as const, label: tr('Blum TANDEMBOX (металлический ящик)') },
              { value: 'merivobox' as const, label: tr('Blum MERIVOBOX (металлический ящик)') },
            ]}
          />
        </Field>
        {showLegacyDrawerProfileWarning(cabinet.drawerSystem, cabinet.sections.some((item) => item.contents.some((content) => content.kind === 'drawers'))) ? (
          <p role="status" className="border border-amber-500 bg-amber-50 px-2 py-1.5 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {tf('Профиль цеха: зазор {gap} мм с каждой стороны, схема отверстий Blum TANDEM. Артикул фурнитуры не определён; проверьте направляющие перед изготовлением.', { gap: projectSettings.drawerRunnerGap ?? DEFAULT_SETTINGS.drawerRunnerGap })}
          </p>
        ) : null}

        {/* Арт қабырғаның биіктігі биіктік класына байланысты, ал бізде әр
            жүйеден бір ғана класс өлшенген — цех оны өз кестесінен қояды. */}
        {cabinet.drawerSystem && METAL_BOX_IDS.includes(cabinet.drawerSystem) ? (
          <Field label={tr('Задняя стенка ящика')} hint={tr('высота по таблице производителя, мм')}>
            <NumberInput
              value={cabinet.metalBoxBackHeight ?? 0}
              min={0}
              max={400}
              invalid={invalid('metalBoxBackHeight')}
              field="metalBoxBackHeight"
              onDraftValidityChange={onDraftValidityChange}
              onChange={(value) => edit('metalBoxBackHeight', {
                metalBoxBackHeight: value > 0 ? value : undefined,
              })}
            />
          </Field>
        ) : null}

        {cabinet.topRails ? (
          <div className="grid grid-cols-3 gap-2">
            <Field label={tr('Ширина планки')} hint={tr('мм')}>
              <NumberInput
                value={cabinet.topRails.width}
                min={20} max={cabinet.depth} step={10}
                invalid={invalid('cabinet.topRails.width')}
                onChange={(width) => edit('topRails.width', {
                  topRails: { ...cabinet.topRails!, width },
                })}
              />
            </Field>
            <Field label={tr('Количество')}>
              <Select
                value={cabinet.topRails.count === 1 ? 'one' : 'two'}
                onChange={(count) => edit('topRails.count', {
                  topRails: { ...cabinet.topRails!, count: count === 'one' ? 1 : 2 },
                })}
                options={[
                  { value: 'two' as const, label: tr('Две (перёд и зад)') },
                  { value: 'one' as const, label: tr('Одна (только зад)') },
                ]}
              />
            </Field>
            <Field label={tr('Положение')} hint={tr('на ребро жёстче')}>
              <Select
                value={cabinet.topRails.orientation ?? 'flat'}
                onChange={(orientation) => edit('topRails.orientation', {
                  topRails: { ...cabinet.topRails!, orientation },
                })}
                options={[
                  { value: 'flat' as const, label: tr('Плашмя') },
                  { value: 'edge' as const, label: tr('На ребро') },
                ]}
              />
            </Field>
          </div>
        ) : null}

        <Field label={tr('Задняя стенка')}>
          <Select
            value={cabinet.back.mode}
            onChange={(mode) => edit('back', { back: { ...cabinet.back, mode } })}
            options={[
              { value: 'overlay', label: tr('Внакладку (на скобы)') },
              { value: 'inset', label: tr('Вкладная (внутрь корпуса)') },
              { value: 'groove', label: tr('В паз 4 мм') },
              // Ядро мұны бұрыннан біледі (ашық стеллаж, стол, кереует
              // каркасы), бірақ экранда таңдау жоқ болатын.
              { value: 'none', label: tr('Без стенки') },
            ]}
          />
        </Field>

        {cabinet.back.mode === 'inset' ? (
          <Field label={tr('Отступ задней стенки')} hint={tr('от заднего края, мм')}>
            <NumberInput
              value={cabinet.back.inset ?? 0}
              min={0}
              max={200}
              onChange={(inset) => edit('back.inset', { back: { ...cabinet.back, inset } })}
            />
          </Field>
        ) : null}

        </Collapsible>
        <Collapsible id="slope" title={tr('Скос (мансарда)')} badge={cabinet.slope ? tr('есть') : tr('нет')}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Скос потолка')} hint={cabinet.slope ? 'боковины трапеции' : 'нет'}>
            <Select
              value={cabinet.slope?.towards ?? 'none'}
              onChange={(value) =>
                edit('slope', value === 'none'
                  ? { slope: undefined }
                  : {
                      slope: {
                        towards: value as 'back' | 'front',
                        lowHeight: cabinet.slope?.lowHeight ?? Math.round(cabinet.height * 0.6),
                      },
                      // Қиғаш тек осы құрастыруда есептеледі.
                      construction: 'sidesOverlay',
                    })
              }
              options={[
                { value: 'none', label: tr('Нет') },
                { value: 'back', label: tr('Понижается назад') },
                { value: 'front', label: tr('Понижается вперёд') },
              ]}
            />
          </Field>
          <Field label={tr('Низкая сторона')} hint={cabinet.slope ? 'мм' : undefined}>
            <NumberInput
              value={cabinet.slope?.lowHeight ?? 0}
              min={0}
              max={4000}
              step={10}
              onChange={(lowHeight) => {
                if (!cabinet.slope) return
                edit('slope.low', { slope: { ...cabinet.slope, lowHeight } })
              }}
            />
          </Field>
        </div>

        </Collapsible>
        <Collapsible id="corner" title={tr('Угловой (переходной)')} badge={cabinet.corner ? `${cabinet.corner.depthAtRight} мм` : tr('нет')}>
        <p className="text-[11px] text-neutral-500">
          Глубина меняется слева направо, задняя стенка встаёт к стене. Пока такой корпус
          делается открытым: фасады, ящики, перегородки и задняя стенка на скошенной
          плоскости требуют своей присадки, и лучше сказать «нельзя», чем присадить
          наполовину верно.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Переходной корпус')}>
            <Select
              value={cabinet.corner ? 'yes' : 'no'}
              onChange={(v) =>
                edit('corner', v === 'yes'
                  ? enableCornerCabinet(cabinet)
                  : { corner: undefined })
              }
              options={[{ value: 'no', label: tr('Нет') }, { value: 'yes', label: tr('Есть') }]}
            />
          </Field>
          <Field label={tr('Глубина справа, мм')} hint={cabinet.corner ? `слева ${cabinet.depth}` : undefined}>
            <NumberInput
              value={cabinet.corner?.depthAtRight ?? 0}
              min={100}
              max={cabinet.depth}
              step={10}
              onChange={(depthAtRight) => {
                if (!cabinet.corner) return
                edit('corner.depth', { corner: { depthAtRight } })
              }}
            />
          </Field>
        </div>

        {/* Фронтальдық панель: бұрыштық орындағы модульдің фасады көршісінің
            тұтқасына соғылмауы үшін. Корпус тікбұрыш күйінде қалады. */}
        </Collapsible>
        <Collapsible id="frontPanel" title={tr('Фронтальная панель')} badge={cabinet.frontPanel ? `${cabinet.frontPanel.width} мм` : tr('нет')}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Ширина')} hint={tr('0 — нет; ниша сужается, мм')}>
            <NumberInput
              value={cabinet.frontPanel?.width ?? 0}
              min={0}
              max={Math.max(0, cabinet.width - 100)}
              step={10}
              invalid={invalid('cabinet.frontPanel.width')}
              onChange={(width) => edit('frontPanel.width', {
                frontPanel: width > 0
                  ? { width, side: cabinet.frontPanel?.side ?? 'left' }
                  : undefined,
              })}
            />
          </Field>
          <Field label={tr('Сторона')}>
            <Select
              value={cabinet.frontPanel?.side ?? 'left'}
              onChange={(side) => {
                if (!cabinet.frontPanel) return
                edit('frontPanel.side', { frontPanel: { ...cabinet.frontPanel, side } })
              }}
              options={[
                { value: 'left' as const, label: tr('Слева') },
                { value: 'right' as const, label: tr('Справа') },
              ]}
            />
          </Field>
        </div>

        </Collapsible>
        <Collapsible id="base" title={tr('Основание и столешница')} defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Основание')} hint={cabinet.base ? `${cabinet.base.height} мм` : 'нет'}>
            <Select
              value={cabinet.base?.kind ?? 'none'}
              onChange={(kind) =>
                edit('base', kind === 'none'
                  ? { base: undefined }
                  : { base: { kind: kind as 'plinth' | 'legs', height: cabinet.base?.height ?? 100 } })
              }
              options={[
                { value: 'none', label: tr('Нет') },
                { value: 'plinth', label: tr('Цоколь') },
                { value: 'legs', label: tr('Ножки') },
              ]}
            />
          </Field>
          <Field label={tr('Высота основания')}>
            <NumberInput
              value={cabinet.base?.height ?? 0}
              min={0}
              max={400}
              step={10}
              onChange={(height) => {
                if (!cabinet.base) return
                edit('base.height', { base: { ...cabinet.base, height } })
              }}
            />
          </Field>
        </div>

        {cabinet.base?.kind === 'legs' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={tr('Стойка (опора)')} hint={tr('отдельный артикул в смете')}>
                <Select
                  value={cabinet.base.legType ?? 'cylinder'}
                  onChange={(legType) => edit('base.legType', {
                    base: { ...cabinet.base!, legType },
                  })}
                  options={[
                    { value: 'cylinder' as const, label: tr('Цилиндр (регулируемая)') },
                    { value: 'cone' as const, label: tr('Конус') },
                    { value: 'square' as const, label: tr('Квадратная') },
                    { value: 'vector' as const, label: tr('Вектор (наклонная)') },
                    { value: 'none' as const, label: tr('Без стойки (скрытая)') },
                  ]}
                />
              </Field>
              {/* Табан — бұранда тесіктерін БЕРЕТІН бөлік. «Жоқ» таңдалса,
                  дноға тесік бұрғыланбайды. */}
              <Field label={tr('Основание')} hint={tr('оно даёт отверстия')}>
                <Select
                  value={cabinet.base.legPlate ?? 'round'}
                  onChange={(legPlate) => edit('base.legPlate', {
                    base: { ...cabinet.base!, legPlate },
                  })}
                  options={[
                    { value: 'round' as const, label: tr('Круглое Ø108') },
                    { value: 'square' as const, label: tr('Квадратное 81×81') },
                    { value: 'none' as const, label: tr('Без основания') },
                  ]}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={tr('Расстояние отверстий')} hint={tr('мм')}>
                <NumberInput
                  value={cabinet.base.legHoleSpacing ?? 65}
                  min={20} max={200}
                  onChange={(legHoleSpacing) => edit('base.legHoleSpacing', {
                    base: { ...cabinet.base!, legHoleSpacing },
                  })}
                />
              </Field>
              <Field label={tr('Шаг опор')} hint={tr('мм')}>
                <NumberInput
                  value={cabinet.base.legStep ?? 600}
                  min={200} max={1200} step={50}
                  onChange={(legStep) => edit('base.legStep', {
                    base: { ...cabinet.base!, legStep },
                  })}
                />
              </Field>
            </div>
          </>
        ) : null}

        {/* Цоколь — КӨРІНЕТІН деталь: көбіне фасадпен бір түсте. */}
        {cabinet.base?.kind === 'plinth' ? (
          <Field
            label={tr('Форма цоколя')}
            hint={cabinet.base.plinthShape === 'box' ? tr('+3 детали') : undefined}
          >
            <Select
              value={cabinet.base.plinthShape ?? 'front'}
              onChange={(plinthShape) => edit('base.plinthShape', {
                base: { ...cabinet.base!, plinthShape },
              })}
              options={[
                { value: 'front' as const, label: tr('Только передняя планка') },
                { value: 'box' as const, label: tr('Короб: перед, зад и бока') },
              ]}
            />
          </Field>
        ) : null}

        {cabinet.base?.kind === 'plinth' && cabinet.base.plinthShape === 'box' ? (
          <Field
            label={tr('Сборка короба')}
            hint={(cabinet.base.plinthJoint ?? 'confirmat') === 'confirmat'
              ? tr('шляпки на лице')
              : tr('лицо чистое')}
          >
            <Select
              value={cabinet.base.plinthJoint ?? 'confirmat'}
              onChange={(plinthJoint) => edit('base.plinthJoint', {
                base: { ...cabinet.base!, plinthJoint },
              })}
              options={[
                { value: 'confirmat' as const, label: tr('Конфирмат (нужны заглушки)') },
                { value: 'minifix' as const, label: tr('Минификс (дороже, лицо чистое)') },
              ]}
            />
          </Field>
        ) : null}

        {cabinet.base?.kind === 'plinth' ? (
          <Field label={tr('Материал цоколя')} hint={tr('обычно как фасад')}>
            <Select
              value={cabinet.base.plinthMaterialId ?? cabinet.carcassMaterialId}
              onChange={(plinthMaterialId) => edit('base.plinthMaterialId', {
                base: { ...cabinet.base!, plinthMaterialId },
              })}
              options={materialOptions(materials.filter(isCarcass))}
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Столешница')}>
            <Select
              value={cabinet.worktop ? 'yes' : 'no'}
              onChange={(value) =>
                edit('worktop', value === 'yes'
                  ? { worktop: { overhangFront: 20, overhangSides: 0 } }
                  : { worktop: undefined })
              }
              options={[{ value: 'no', label: tr('Нет') }, { value: 'yes', label: tr('Есть') }]}
            />
          </Field>
          <Field label={tr('Свес вперёд')} hint={cabinet.worktop ? 'мм' : undefined}>
            <NumberInput
              value={cabinet.worktop?.overhangFront ?? 0}
              min={0}
              max={200}
              step={5}
              onChange={(overhangFront) => {
                if (!cabinet.worktop) return
                edit('worktop.front', { worktop: { ...cabinet.worktop, overhangFront } })
              }}
            />
          </Field>
        </div>
        <FixtureFields onDraftValidityChange={onDraftValidityChange} />

        </Collapsible>
        <Collapsible id="rails" title={tr('Планки и фартук')} badge={`${(cabinet.rails ?? []).length + (cabinet.backsplash ? 1 : 0)}`}>
        <p className="text-[11px] text-neutral-500">
          Планка (царга) ставится вместо сплошной крышки: под столешницей она не нужна.
          Фальш-панель закрывает зазор сбоку от корпуса.
        </p>
        <div className="space-y-2">
          {(cabinet.rails ?? []).map((r, i) => (
            <div key={r.id} className="space-y-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500">
                  {r.kind === 'filler' ? 'Фальш-панель' : 'Планка'} {i + 1}
                </span>
                <Button
                  title={tr('Удалить')}
                  onClick={() => edit('rails', { rails: (cabinet.rails ?? []).filter((x) => x.id !== r.id) })}
                >
                  ✕
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label={tr('Тип')}>
                  <Select
                    value={r.kind}
                    onChange={(kind) =>
                      edit('rails', {
                        rails: (cabinet.rails ?? []).map((x) =>
                          x.id === r.id
                            // Фальш-панель тек бүйірде тұрады: түрін ауыстырғанда
                            // орнын да дұрыстаймыз, әйтпесе қате шығар еді.
                            ? {
                              ...x,
                              kind: kind as RailKind,
                              position: kind === 'filler' && (x.position === 'top' || x.position === 'bottom')
                                ? 'left'
                                : x.position,
                            }
                            : x),
                      })
                    }
                    options={[
                      { value: 'carcass', label: tr('Корпусная') },
                      { value: 'facade', label: tr('Фасадная') },
                      { value: 'filler', label: tr('Фальш-панель') },
                    ]}
                  />
                </Field>
                <Field label={tr('Расположение')}>
                  <Select
                    value={r.position}
                    onChange={(position) =>
                      edit('rails', {
                        rails: (cabinet.rails ?? []).map((x) =>
                          x.id === r.id ? { ...x, position: position as RailPosition } : x),
                      })
                    }
                    options={
                      r.kind === 'filler'
                        ? [{ value: 'left', label: tr('Слева') }, { value: 'right', label: tr('Справа') }]
                        : [
                          { value: 'top', label: tr('Сверху') },
                          { value: 'bottom', label: tr('Снизу') },
                          { value: 'left', label: tr('Слева') },
                          { value: 'right', label: tr('Справа') },
                        ]
                    }
                  />
                </Field>
                <Field label={tr('Ширина, мм')}>
                  <NumberInput
                    value={r.width}
                    min={20}
                    step={10}
                    onChange={(width) =>
                      edit('rails.width', {
                        rails: (cabinet.rails ?? []).map((x) => (x.id === r.id ? { ...x, width } : x)),
                      })
                    }
                  />
                </Field>
                <Field label={r.kind === 'filler' ? 'Отступ от корпуса, мм' : 'Отступ по краю, мм'}>
                  <NumberInput
                    value={r.inset}
                    min={0}
                    step={5}
                    onChange={(inset) =>
                      edit('rails.inset', {
                        rails: (cabinet.rails ?? []).map((x) => (x.id === r.id ? { ...x, inset } : x)),
                      })
                    }
                  />
                </Field>
                {r.kind === 'carcass' ? (
                  <Field label={tr('Отступ от фронта, мм')}>
                    <NumberInput
                      value={r.depthOffset}
                      min={0}
                      step={5}
                      onChange={(depthOffset) =>
                        edit('rails.depth', {
                          rails: (cabinet.rails ?? []).map((x) => (x.id === r.id ? { ...x, depthOffset } : x)),
                        })
                      }
                    />
                  </Field>
                ) : null}
              </div>
            </div>
          ))}
          <Button
            onClick={() =>
              edit('rails', {
                rails: [
                  ...(cabinet.rails ?? []),
                  {
                    id: `r${Date.now().toString(36)}`,
                    kind: 'carcass' as const,
                    position: 'top' as const,
                    width: 100,
                    inset: 0,
                    depthOffset: 0,
                  },
                ],
              })
            }
          >
            + Планка
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Фартук')}>
            <Select
              value={cabinet.backsplash ? 'yes' : 'no'}
              onChange={(v) =>
                edit('backsplash', v === 'yes'
                  ? { backsplash: { height: 600 } }
                  : { backsplash: undefined })
              }
              options={[{ value: 'no', label: tr('Нет') }, { value: 'yes', label: tr('Есть') }]}
            />
          </Field>
          <Field label={tr('Высота фартука, мм')}>
            <NumberInput
              value={cabinet.backsplash?.height ?? 0}
              min={100}
              max={1200}
              step={10}
              onChange={(height) => {
                if (!cabinet.backsplash) return
                edit('backsplash.height', { backsplash: { ...cabinet.backsplash, height } })
              }}
            />
          </Field>
        </div>

        </Collapsible>
      </div>

      {/* ═══ МАТЕРИАЛ: корпус, фасад, задняя стенка (декор + кромка одним выбором) ═══ */}
      <div className={cn('flex-col gap-3', tab === 'material' ? 'flex' : 'hidden')}>
        <Collapsible id="materials" title={tr('Материалы')} defaultOpen>
        <Field label={tr('Корпус')}>
          <DecorPicker
            materials={carcassMaterials}
            value={cabinet.carcassMaterialId}
            onChange={(id) => {
              const m = carcassMaterials.find((x) => x.id === id)
              edit('carcassMaterial', {
                carcassMaterialId: id,
                // Кромка декорға байланады: декоры сәйкес келмеген кромка — брак.
                ...(m?.defaultEdging ? { edging: m.defaultEdging } : {}),
              })
            }}
          />
        </Field>
        <Field label={tr('Фасад')}>
          <DecorPicker
            materials={carcassMaterials}
            value={cabinet.frontMaterialId}
            onChange={(frontMaterialId) => edit('frontMaterial', { frontMaterialId })}
          />
        </Field>
        <Field label={tr('Задняя стенка')}>
          <Select
            value={cabinet.backMaterialId}
            onChange={(backMaterialId) => edit('backMaterial', { backMaterialId })}
            options={materialOptions(backMaterials)}
          />
        </Field>
        </Collapsible>
      </div>

      {/*
        ═══ ЕСЕПТЕР: баға, деталировка үзіндісі, фурнитура ═══
        PRO100-дың «Reports» қосымшасына сәйкес, бірақ толық есеп бөлек
        терезеде («Смета и раскрой») қалады — мұнда тек қысқа үзінді әрі
        сол терезеге апаратын батырма. Ядроның `formatCutList`-і қайта
        жазылмайды, дәл CutListTable қолданатын функция осында да шақырылады.
      */}
      <div className={cn('flex-col gap-3', tab === 'reports' ? 'flex' : 'hidden')}>
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>{tr('Деталировка — кратко')}</SectionTitle>
          <Button onClick={() => setQuoteOpen(true)}>{tr('Открыть смету')}</Button>
        </div>
        {cutRows.length === 0 ? (
          <p className="text-xs text-neutral-500">{tr('Нет деталей.')}</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-1 text-left">{tr('Наименование')}</th>
                  <th className="py-1 text-right">{tr('Кол-во')}</th>
                  <th className="py-1 text-right">{tr('Готовый')}</th>
                </tr>
              </thead>
              <tbody>
                {cutRows.slice(0, CUT_SNIPPET_LIMIT).map((r, i) => (
                  <tr key={`${r.name}-${i}`} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-1">{r.name}</td>
                    <td className="py-1 text-right tabular-nums">{r.qty}</td>
                    <td className="py-1 text-right tabular-nums text-neutral-500">
                      {r.finishedLength}×{r.finishedWidth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cutRows.length > CUT_SNIPPET_LIMIT ? (
              <p className="text-[11px] text-neutral-400">
                {tr('и ещё')} {cutRows.length - CUT_SNIPPET_LIMIT}…
              </p>
            ) : null}
          </>
        )}
        <p className="text-[10px] leading-relaxed text-neutral-400">
          {tr('Цена, услуги цеха и полный список фурнитуры — в смете. Здесь только деталировка для ориентира.')}
        </p>
      </div>

      {/*
        ═══ ПРОИЗВОДСТВО: присадка, раскрой, ЧПУ-экспорт ═══
        Бізде бар, PRO100-да ЖОҚ (ол жұмысты Базиске тапсырады). Редакторлар
        бөлек терезелерде/беттерде қалады — төртінші қосымша тек ашатын жол.
      */}
      <div className={cn('flex-col gap-3', tab === 'production' ? 'flex' : 'hidden')}>
        <p className="text-[11px] text-neutral-500">
          {tr('Присадка, раскрой и экспорт для станка — прямо в AisMebel, без передачи в Базис.')}
        </p>
        <Field label={tr('Крепёж корпуса')}>
          <Select
            value={cabinet.carcassJoint ?? 'confirmat'}
            onChange={(carcassJoint) => edit('carcassJoint', { carcassJoint })}
            options={[
              { value: 'confirmat', label: tr('Конфирмат') },
              { value: 'minifix', label: tr('Минификс') },
            ]}
          />
        </Field>
        <p className="text-[10px] text-neutral-500">
          {cabinet.carcassJoint ? tr('Источник: этот корпус') : tr('Источник: по умолчанию')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDrillOpen(true)}>{tr('Открыть присадку')}</Button>
          <Link
            href="/cut"
            title={tr('Отдельный экран раскроя: КИМ, резы, бирки')}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            {tr('Открыть раскрой')}
          </Link>
        </div>
        <ExportMenu cabinet={cabinet} panels={panels} />
      </div>

      <div className={cn(tab === 'general' ? 'block' : 'hidden')}>
      <div className="flex items-center justify-between pt-1">
        <SectionTitle>{tr('Секции')} ({cabinet.sections.length})</SectionTitle>
        <Button onClick={() => setSectionAddError(addSection())} disabled={cabinet.sections.length >= 12}>
          + секция
        </Button>
      </div>
      {sectionAddError ? <p role="alert" className="border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        {sectionAddError} {tr('Увеличьте ширину корпуса или уменьшите число фасадов.')}
      </p> : null}
      <div className="space-y-2">
        {cabinet.sections.map((section, i) => (
          <SectionEditor key={section.id} section={section} index={i} computedWidth={computedSectionWidths[i]}
            invalidField={invalidField} onDraftValidityChange={onDraftValidityChange} />
        ))}
      </div>

      <SectionTitle>{tr('Вид')}</SectionTitle>
      <Toggle checked={showDimensions} onChange={setShowDimensions} label={tr('Показывать габариты')} />
      </div>
    </div>
  )
}
