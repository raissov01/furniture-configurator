'use client'

/**
 * Сол жақ панель: параметрлер. Мұнда геометрия ЕСЕПТЕЛМЕЙДІ — тек конфиг
 * өзгереді, қалғанын ядро жасайды (CLAUDE.md §3).
 */

import { t as tr } from '@/lib/i18n'
import { Button, Field, NumberInput, SectionTitle, Select, Toggle } from '@/components/ui'
import { DecorPicker } from '@/components/DecorPicker'
import {
  APPLIANCES, DEFAULT_SETTINGS, FILLINGS, HANDLE_POSITIONS, MILLING_PATTERNS,
  defaultHandleSpec, defaultMillingSpec, findTemplate, handlePositionName, millingPattern,
} from '@/src/core/index'
import { activeCabinet, useConfigurator } from '@/store/configurator'
import type {
  ApplianceKind, CabinetConfig, FillingKind, HandleSpec, Material, MillingSpec,
  RailKind, RailPosition, Section, SectionContent, SectionFronts,
} from '@/src/core/index'

const materialOptions = (list: Material[]) => list.map((m) => ({ value: m.id, label: m.name }))

/** Корпус пен фасадқа — қалың плита, арт қабырғаға — жұқа. */
const isCarcass = (m: Material) => m.thickness >= 10

function SectionEditor({ section, index }: { section: Section; index: number }) {
  const editSection = useConfigurator((s) => s.editSection)
  const removeSection = useConfigurator((s) => s.removeSection)
  const canRemove = useConfigurator((s) => activeCabinet(s).sections.length > 1)

  const shelves = section.contents.find((c) => c.kind === 'shelves')
  const stand = section.contents.find((c) => c.kind === 'stand')
  const drawers = section.contents.find((c) => c.kind === 'drawers')
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
    const shelfCount = next.shelfCount ?? shelves?.count ?? 0
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
    const fillingKind = next.filling === undefined
      ? (filling?.kind === 'filling' ? filling.filling : null)
      : next.filling
    const applianceKind = next.appliance === undefined
      ? (appliance?.kind === 'appliance' ? appliance.appliance : null)
      : next.appliance

    const contents: SectionContent[] = []
    // Техника ең ТӨМЕНДЕ: духовка мен посудомойка еденге жақын тұрады.
    if (applianceKind) contents.push({ kind: 'appliance', appliance: applianceKind })
    if (drawerCount > 0) contents.push({ kind: 'drawers', count: drawerCount })
    if (shelfCount > 0) {
      contents.push({
        kind: 'shelves', count: shelfCount, shelfKind,
        ...(shelfInsets ? { insets: shelfInsets } : {}),
        ...(shelfAt && shelfAt.length > 0 ? { at: shelfAt } : {}),
      })
    }
    // Стойка сөренің ҮСТІНДЕ бөлек жолақ болып тұрады: солай ғана «төменде
    // сөре, жоғарыда екі бөлік» деген тор шығады.
    if (standCount > 0) contents.push({ kind: 'stand', count: standCount })
    // Механизм сөренің үстінде, штанганың астында.
    if (fillingKind) contents.push({ kind: 'filling', filling: fillingKind })
    // Штанга ең ҮСТІНДЕ: киім ілінетін жер жоғарыда болады.
    if (hasRod) contents.push({ kind: 'rod' })
    if (contents.length === 0) contents.push({ kind: 'empty' })

    editSection(index, { contents }, 'section.fill')
  }

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-neutral-500">Секция {index + 1}</span>
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
                  ? { widthMode, width: section.width ?? 400 }
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
        <Field label={tr('мм')} hint={section.widthMode === 'flex' ? 'считается' : undefined}>
          <NumberInput
            value={section.width ?? 0}
            min={100}
            step={10}
            onChange={(width) => editSection(index, { width }, 'section.width')}
          />
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
              value={(shelves.at ?? []).join(', ')}
              onChange={(e) => {
                const list = e.target.value
                  .split(/[,;\s]+/)
                  .map((part) => Number(part))
                  .filter((n) => Number.isFinite(n) && n > 0)
                  .map((n) => Math.round(n))
                setFill({ shelfAt: list.length > 0 ? list : null })
              }}
              placeholder="320, 700, 1150"
              className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </Field>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Field label={tr('Полок')}>
          <NumberInput
            value={shelves?.count ?? 0}
            min={0}
            max={20}
            onChange={(shelfCount) => setFill({ shelfCount })}
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

      <div className="grid grid-cols-2 gap-2">
        <Field label={tr('Фасадов')}>
          <NumberInput
            value={section.fronts?.count ?? 0}
            min={0}
            max={8}
            onChange={(count) =>
              editSection(
                index,
                // Ілгек пен тұтқа САҚТАЛАДЫ: санды өзгерту оларды тастап
                // кетсе, баптау үнсіз әдепкіге қайтар еді.
                { fronts: count > 0 ? { ...(section.fronts ?? { mount: 'overlay' }), count } : null },
                'section.fronts',
              )
            }
          />
        </Field>
        <Field label={tr('Тип фасада')}>
          <Select
            value={section.fronts?.mount ?? 'overlay'}
            onChange={(mount) =>
              editSection(
                index,
                { fronts: { ...(section.fronts ?? { count: 1 }), mount } },
                'section.frontMount',
              )
            }
            options={[
              { value: 'overlay', label: tr('Накладной') },
              { value: 'inset', label: tr('Вкладной') },
            ]}
          />
        </Field>
      </div>

      {section.fronts ? (
        <FrontFittings
          fronts={section.fronts}
          onChange={(patch, field) => editSection(index, { fronts: { ...section.fronts!, ...patch } }, field)}
        />
      ) : null}
    </div>
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
}: {
  fronts: SectionFronts
  onChange: (patch: Partial<SectionFronts>, field: string) => void
}) {
  const shop = useConfigurator((s) => s.shop)
  const systems = shop.hingeSystems
  const handles = shop.handles

  const hingeId = fronts.hingeSystemId ?? systems[0]?.id ?? ''
  // undefined — цехтың әдепкісі, null — әдейі тұтқасыз.
  const handleSpec: HandleSpec | null = fronts.handle === null ? null : fronts.handle ?? defaultHandleSpec()
  const model = handleSpec ? handles.find((h) => h.id === handleSpec.handleId) : undefined
  const spacings = model?.boreSpacings ?? []

  const setHandle = (patch: Partial<HandleSpec>, field: string) => {
    if (!handleSpec) return
    onChange({ handle: { ...handleSpec, ...patch } }, field)
  }

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
          onChange={(opening) => onChange({ opening }, 'section.opening')}
          options={[
            { value: 'auto' as const, label: tr('Автоматически') },
            { value: 'left' as const, label: tr('Все влево') },
            { value: 'right' as const, label: tr('Все вправо') },
          ]}
        />
      </Field>

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
          onChange={(hingeSystemId) => onChange({ hingeSystemId }, 'section.hinge')}
          options={systems.map((h) => ({ value: h.id, label: h.name }))}
        />
      </Field>

      <Field label={tr('Ручка')}>
        <Select
          value={handleSpec ? handleSpec.handleId : 'none'}
          onChange={(id) =>
            onChange(
              id === 'none'
                ? { handle: null }
                : { handle: { ...(handleSpec ?? defaultHandleSpec()), handleId: id } },
              'section.handle',
            )
          }
          options={[
            ...handles.map((h) => ({ value: h.id, label: h.name })),
            { value: 'none', label: tr('— Без ручки —') },
          ]}
        />
      </Field>

      {handleSpec && spacings.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr('Межцентровое, мм')}>
            <Select
              value={String(handleSpec.boreSpacing)}
              onChange={(v) => setHandle({ boreSpacing: Number(v) }, 'section.handleBore')}
              options={spacings.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </Field>
          <Field label={tr('Расположение')}>
            <Select
              value={handleSpec.position}
              onChange={(position) =>
                setHandle({ position: position as HandleSpec['position'] }, 'section.handlePosition')
              }
              options={HANDLE_POSITIONS.map((p) => ({ value: p, label: handlePositionName(p) }))}
            />
          </Field>
          <Field label={tr('Отступ от края, мм')}>
            <NumberInput
              value={handleSpec.edgeOffset}
              min={0}
              onChange={(edgeOffset) => setHandle({ edgeOffset }, 'section.handleEdgeOffset')}
            />
          </Field>
          <Field label={tr('Отступ от торца, мм')}>
            <NumberInput
              value={handleSpec.endOffset}
              min={0}
              onChange={(endOffset) => setHandle({ endOffset }, 'section.handleEndOffset')}
            />
          </Field>
        </div>
      ) : null}
    </div>
  )
}

export function Configurator({ invalidField }: { invalidField: string | null }) {
  const cabinet: CabinetConfig = useConfigurator(activeCabinet)
  const edit = useConfigurator((s) => s.edit)
  const addSection = useConfigurator((s) => s.addSection)
  const showDimensions = useConfigurator((s) => s.showDimensions)
  const setShowDimensions = useConfigurator((s) => s.setShowDimensions)
  const setGalleryOpen = useConfigurator((s) => s.setGalleryOpen)
  // Материалдар тізімі цехтың профилінен келеді, кодтан емес.
  const materials = useConfigurator((s) => s.shop.materials)
  const carcassMaterials = materials.filter(isCarcass)
  const backMaterials = materials.filter((m) => !isCarcass(m))
  const template = findTemplate(useConfigurator((s) => s.templateId))

  const invalid = (field: string) => invalidField === field
  /** Шаблон ұсынған аралық — қатты шектеу емес, тек бағдар. */
  const hint = (axis: 'height' | 'width' | 'depth') =>
    template ? `${template.range[axis].min}–${template.range[axis].max}` : undefined

  return (
    <div className="space-y-3">
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

      <SectionTitle>{tr('Габарит — H × W × D, мм')}</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Field label={tr('Высота (H)')} hint={hint('height')}>
          <NumberInput
            value={cabinet.height} min={100} max={4000} step={10} invalid={invalid('cabinet.height')}
            onChange={(height) => edit('height', { height })}
          />
        </Field>
        <Field label={tr('Ширина (W)')} hint={hint('width')}>
          <NumberInput
            value={cabinet.width} min={100} max={4000} step={10} invalid={invalid('cabinet.width')}
            onChange={(width) => edit('width', { width })}
          />
        </Field>
        <Field label={tr('Глубина (D)')} hint={hint('depth')}>
          <NumberInput
            value={cabinet.depth} min={100} max={4000} step={10} invalid={invalid('cabinet.depth')}
            onChange={(depth) => edit('depth', { depth })}
          />
        </Field>
      </div>

      <SectionTitle>{tr('Конструкция')}</SectionTitle>
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
          бүйірді жабады, ал ішкі жағы көршісіне тіреледі. */}
      <div className="grid grid-cols-2 gap-2">
        {([['top', 'Крышка'], ['bottom', 'Дно']] as const).map(([which, label]) => (
          <Field key={which} label={tr(label)}>
            <Select
              value={cabinet.mounts?.[which] ?? (cabinet.construction === 'sidesOverlay' ? 'inset' : 'overlay')}
              onChange={(mount) => edit(`mounts.${which}`, {
                mounts: { ...cabinet.mounts, [which]: mount },
              })}
              options={[
                { value: 'inset' as const, label: tr('Вкладной') },
                { value: 'overlay' as const, label: tr('Накладной') },
                { value: 'overlayLeft' as const, label: tr('Накладной слева') },
                { value: 'overlayRight' as const, label: tr('Накладной справа') },
              ]}
            />
          </Field>
        ))}
      </div>
      {/* Крыша: тұтас панель, ПЛАНКА немесе жоқ. Ас үй тумбасында үстінде
          столешница жатады да, тұтас крышаның қажеті болмайды. */}
      <Field label={tr('Крыша')} hint={tr('под столешницей хватает планок')}>
        <Select
          value={cabinet.openTop ? 'none' : cabinet.topRails ? 'rails' : 'panel'}
          onChange={(kind) => edit('topKind', {
            openTop: kind === 'none' ? true : undefined,
            topRails: kind === 'rails'
              ? (cabinet.topRails ?? { width: 100, count: 2 })
              : undefined,
          })}
          options={[
            { value: 'panel' as const, label: tr('Панель') },
            { value: 'rails' as const, label: tr('Планка (царга)') },
            { value: 'none' as const, label: tr('Нет') },
          ]}
        />
      </Field>

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

      <SectionTitle>{tr('Скос (мансарда)')}</SectionTitle>
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

      <SectionTitle>{tr('Угловой (переходной)')}</SectionTitle>
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
                ? {
                  corner: { depthAtRight: Math.round(cabinet.depth / 2) },
                  // Шектеулерді UI-дың өзінде орындаймыз: әйтпесе қосқан бойда
                  // қате шығып, пайдаланушы себебін іздеп отырар еді.
                  back: { mode: 'none' as const },
                  sections: [{ ...cabinet.sections[0]!, fronts: null }],
                }
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

      <SectionTitle>{tr('Основание и столешница')}</SectionTitle>
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
        <Field label={tr('Тип ножки')} hint={tr('отдельный артикул в смете')}>
          <Select
            value={cabinet.base.legType ?? 'cylinder'}
            onChange={(legType) => edit('base.legType', {
              base: { ...cabinet.base!, legType },
            })}
            options={[
              { value: 'cylinder' as const, label: tr('Цилиндр (регулируемая)') },
              { value: 'cone' as const, label: tr('Конус') },
              { value: 'square' as const, label: tr('Квадратная') },
              { value: 'hidden' as const, label: tr('Скрытая (под цоколь)') },
            ]}
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

      <SectionTitle>{tr('Планки и фартук')}</SectionTitle>
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

      <SectionTitle>{tr('Двери')}</SectionTitle>
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

      <SectionTitle>{tr('Материалы')}</SectionTitle>
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

      <SectionTitle>{tr('Вид')}</SectionTitle>
      <Toggle checked={showDimensions} onChange={setShowDimensions} label={tr('Показывать габариты')} />
    </div>
  )
}
