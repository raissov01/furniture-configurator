'use client'

/**
 * `/cut` — раскройдың ЖЕКЕ беті.
 *
 * Смета терезесіндегі «Раскрой» табы карта көрсетеді, ал цехтың станокқа
 * баратын адамына одан артық керек: пропил мен подрезка қанша қойылған,
 * әр парақтың КИМ-і қандай, неше рез, қанша метр, парақты неше рет бұру
 * керек. Сол сұрақтардың бәрі БІР экранда тұруы үшін бөлек бет жасалды —
 * оны басып шығарып, станоктың қасына іліп қоюға болады.
 *
 * Мұнда бірде бір сан ЕСЕПТЕЛМЕЙДІ: бәрі `nestPanels` пен `cutPlan`-нан
 * келеді, сондықтан экрандағы сан мен экспорттағы сан ажырамайды (§3).
 */

import { t as tr } from '@/lib/i18n'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Button, Field, NumberInput, Select } from '@/components/ui'
import { projectProduction } from '@/lib/projectProduction'
import { flatArchiveFiles } from '@/lib/flatArchiveFiles'
import {
  ConfigValidationError,
  flattenTree,
  mergeSettings,
  nestPanels,
  nestingOptionsOf,
  partLabels,
  unplacedAdvice,
} from '@/src/core/index'
import type {
  CutLine, CutStats, NestedSheet, OptimizationLevel, SheetCutPlan,
} from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import { cn } from '@/lib/cn'
import { cutDisplay, visibleMaterials } from '@/lib/cutView'
import { playbackStep } from '@/src/core/cutPlayback'
import { labelExportOptions, labelSizeLimits } from '@/lib/labelExportOptions'
import { CLOUD_PROJECT_BINDING_KEY, currentCloudProjectId } from '@/lib/cloudProjectBinding'
import { cutExportAllowed, safeCutPlan } from '@/lib/safeCutPlan'
import type { LabelPage } from '@/src/core/export/labelLayout'
import { panelDisplayLabel } from '@/lib/panelDisplay'

/**
 * ⚠ Тізім ФУНКЦИЯ, тұрақты емес. Модуль деңгейіндегі `tr()` тіл сақтаудан
 * оқылғанға ДЕЙІН орындалады да, экранда әрқашан орысша қалып қояды.
 */
const optimizationOptions = (): { value: OptimizationLevel; label: string }[] => [
  { value: 'fast', label: tr('Быстрая — одна раскладка') },
  { value: 'standard', label: tr('Обычная — четыре раскладки') },
  { value: 'deep', label: tr('Глубокая — все шестнадцать') },
]

/** Подрезка «материалдан» дегенді бөлек мән етіп көрсетеміз. */
const TRIM_FROM_MATERIAL = -1

const metres = (mm: number): string => (mm / 1000).toFixed(1)
const squareMetres = (mm2: number): string => (mm2 / 1_000_000).toFixed(2)

function download(filename: string, data: Uint8Array | string, mime: string): void {
  const blob = new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Қаріп pdf-lib-ке сырттан беріледі: стандарт қаріптері кириллицаны білмейді. */
async function loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  const [regular, bold] = await Promise.all([
    fetch('/fonts/DejaVuSans-subset.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/DejaVuSans-Bold-subset.ttf').then((r) => r.arrayBuffer()),
  ])
  return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) }
}

export function CutPage() {
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const autoJoints = useConfigurator((s) => s.autoJoints)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const projectName = useConfigurator((s) => s.projectName)
  const exportProject = useConfigurator((s) => s.exportProject)
  const room = useConfigurator((s) => s.room)
  const info = useConfigurator((s) => s.projectInfo)
  const priceOverrides = useConfigurator((s) => s.priceOverrides)
  const lights = useConfigurator((s) => s.lights)
  const projectLoadError = useConfigurator((s) => s.projectLoadError)
  const catalog = useConfigurator((s) => s.catalog)
  const shop = useConfigurator((s) => s.shop)
  const editShop = useConfigurator((s) => s.editShop)
  const hydrateShop = useConfigurator((s) => s.hydrateShop)
  const hydrateProject = useConfigurator((s) => s.hydrateProject)

  // Сақталған жоба мен цех профилі тек браузерде оқылады — серверде оқысақ,
  // гидратация сәйкессіздігі шығады (Workspace-тегі себеп).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    hydrateShop()
    hydrateProject()
    setMounted(true)
  }, [hydrateShop, hydrateProject])

  const [cloudId, setCloudId] = useState<string | null>(null)
  useEffect(() => {
    if (!mounted) return
    let active = true
    void currentCloudProjectId(exportProject(), window.localStorage.getItem(CLOUD_PROJECT_BINDING_KEY))
      .then((id) => { if (active) setCloudId(id) })
      .catch(() => { if (active) setCloudId(null) })
    return () => { active = false }
  }, [mounted, exportProject, root, layers, autoJoints, settings, catalog, projectName, room, info, priceOverrides, lights])

  const [showCuts, setShowCuts] = useState(true)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [materialFilter, setMaterialFilter] = useState('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [labelPage, setLabelPage] = useState<LabelPage>('a4')
  const [labelWidth, setLabelWidth] = useState(58)
  const [labelHeight, setLabelHeight] = useState(40)
  const [labelDraftInvalid, setLabelDraftInvalid] = useState<Record<string, boolean>>({})
  const [kerfDraftInvalid, setKerfDraftInvalid] = useState(false)
  /** Экспорттың ескертуі (мыс. Базис қазақ әріптерін оқымайды). */
  const [notice, setNotice] = useState<string | null>(null)
  const labelOptions = useMemo(() => {
    try {
      if (!cloudId) return { value: null, error: tr('Для QR сначала сохраните проект в облаке') }
      return { value: labelExportOptions(
        { page: labelPage, widthMm: labelWidth, heightMm: labelHeight },
        cloudId ?? '', 1,
      ), error: null }
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [labelPage, labelWidth, labelHeight, cloudId])
  const labelsReady = labelOptions.value !== null && !Object.values(labelDraftInvalid).some(Boolean)

  const verifyLabelProject = async () => {
    if (!cloudId) throw new Error(tr('Для QR сначала сохраните проект в облаке'))
    const localId = await currentCloudProjectId(exportProject(), window.localStorage.getItem(CLOUD_PROJECT_BINDING_KEY))
    if (localId !== cloudId) throw new Error(tr('Проект изменён. Сохраните его в облаке снова для QR.'))
    const response = await fetch(`/api/projects/${encodeURIComponent(cloudId)}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error(tr('Проект для QR не найден на сервере. Сохраните его снова.'))
    const body = await response.json() as { project?: unknown }
    const serverId = await currentCloudProjectId(body.project, window.localStorage.getItem(CLOUD_PROJECT_BINDING_KEY))
    if (serverId !== cloudId) throw new Error(tr('Проект изменён. Сохраните его в облаке снова для QR.'))
  }

  const production = useMemo(() => {
    if (projectLoadError) return { panels: [], error: projectLoadError }
    const broken = autoJoints.find((joint) => joint.status === 'broken')
    if (broken) return { panels: [],
      error: `${broken.error?.field ?? 'joint.boardIds'}: ${tr('Автоматическая присадка нарушена')}. ${tr('Проверьте контакт досок и крепёж')}` }
    try {
      const scene = flattenTree(root, catalog, settings, layers, autoJoints)
      return { panels: projectProduction(root, scene).panels, error: null }
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      return { panels: [], error: error.message }
    }
  }, [root, catalog, settings, layers, autoJoints, projectLoadError])
  const panels = production.panels
  // §O6: ойма бар панельдің DXF рез координатасы генерациямен бір
  // catalog/settings-ке сүйенуі керек (`flattenTree` осы project settings-ті
  // қолданады). Кабинет деңгейіндегі жеке override мұнда бірнеше корпус
  // араласқандықтан ескерілмейді — nestPanels/unplacedAdvice те солай.
  const dxfOptions = useMemo(() => ({ catalog, settings: mergeSettings(settings) }), [catalog, settings])

  const cutting = shop.cutting
  const options = useMemo(() => nestingOptionsOf(shop), [shop])
  const nested = useMemo(() => {
    if (production.error || panels.length === 0) return { nesting: null, error: production.error }
    try {
      return { nesting: nestPanels(panels, catalog, options), error: null }
    } catch (error) {
      if (!(error instanceof ConfigValidationError)) throw error
      return { nesting: null, error: error.message }
    }
  }, [panels, production.error, catalog, options])
  const nesting = nested.nesting
  const planned = useMemo(
    () => safeCutPlan(nesting, cutting.kerf),
    [nesting, cutting.kerf],
  )
  const plan = planned.plan
  const cutExportReady = cutExportAllowed(planned.error, kerfDraftInvalid)
  const advice = useMemo(
    () => (nesting ? unplacedAdvice(nesting, panels, catalog, options) : []),
    [nesting, panels, catalog, options],
  )

  const setCutting = (patch: Partial<typeof cutting>) =>
    editShop({ cutting: { ...cutting, ...patch } })

  const run = async (kind: string, action: () => Promise<void>) => {
    setBusy(kind)
    try {
      await action()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <main data-cut-panel-count={panels.length} className="min-h-screen min-w-0 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-wrap items-center gap-2 px-4 py-2.5">
          <Link
            href="/configurator"
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-300"
          >
            ← {tr('Конфигуратор')}
          </Link>
          <h1 className="text-sm font-semibold">{tr('Раскрой')}</h1>
          <span className="min-w-0 max-w-full truncate text-[11px] text-neutral-500">{projectName}</span>
          <button type="button" className="ml-auto border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 sm:hidden"
            aria-expanded={showMobileActions} aria-controls="cut-export-actions"
            onClick={() => setShowMobileActions((current) => !current)}>{tr('Экспорт')}</button>

          <div id="cut-export-actions" data-testid="cut-export-actions"
            className={cn('w-full min-w-0 grid-cols-2 gap-1 [&>button]:min-w-0 [&>button]:whitespace-normal sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:items-center',
              showMobileActions ? 'grid' : 'hidden')}>
            <Button active={showCuts} ariaPressed={showCuts} onClick={() => setShowCuts(!showCuts)}>
              {tr('Показать резы')}
            </Button>
            <Button
              disabled={busy !== null || !nesting || !cutExportReady}
              title={tr('Карта раскроя для цеха, по листу на страницу')}
              onClick={() => void run('map', async () => {
                const { nestingPdf } = await import('@/src/core/export/nestingPdf')
                const bytes = await nestingPdf({ nesting: nesting!, projectName, fonts: await loadFonts() })
                download(`${projectName}-раскрой.pdf`, bytes, 'application/pdf')
              })}
            >
              {busy === 'map' ? '…' : tr('PDF карты')}
            </Button>
            <Button
              disabled={busy !== null || !nesting || !cutExportReady}
              title={tr('DXF карты раскроя по листам; присадка — в пакете для цеха или ЧПУ по деталям')}
              onClick={() => void run('dxf', async () => {
                const [{ nestingToDxfFiles }, { zipSync, strToU8 }] = await Promise.all([
                  import('@/src/core/export/dxf'),
                  import('fflate'),
                ])
                const entries: Record<string, Uint8Array> = {}
                for (const [name, content] of flatArchiveFiles(nestingToDxfFiles(nesting!))) entries[name] = strToU8(content)
                download(
                  `${projectName}-раскрой-dxf.zip`,
                  zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }),
                  'application/zip',
                )
              })}
            >
              {busy === 'dxf' ? '…' : 'DXF'}
            </Button>
            <Button
              disabled={busy !== null || !nesting || !cutExportReady || !labelsReady}
              title={tr('Бирки на детали: позиция, размер реза, кромка по кромкам')}
              onClick={() => void run('labels', async () => {
                await verifyLabelProject()
                const { labelsPdf } = await import('@/src/core/export/labels')
                const bytes = await labelsPdf({
                  labels: partLabels(panels, catalog, nesting!),
                  projectName,
                  fonts: await loadFonts(),
                  ...labelOptions.value!,
                })
                download(`${projectName}-бирки.pdf`, bytes, 'application/pdf')
              })}
            >
              {busy === 'labels' ? '…' : tr('Бирки')}
            </Button>
            <Button
              disabled={busy !== null || !nesting || !cutExportReady || !labelsReady}
              title={tr('Пакет: DXF пластей деталей, EDGE-DRILLING.csv для торцов, карта раскроя, деталировка и бирки. Полный ЧПУ CSV — отдельная кнопка.')}
              onClick={() => void run('bundle', async () => {
                await verifyLabelProject()
                const [
                  { nestingToDxfFiles, cabinetToDxfArchiveFiles }, { cutListToCsv },
                  { labelsPdf, labelsToCsv }, { nestingPdf }, { zipSync, strToU8 },
                ] = await Promise.all([
                  import('@/src/core/export/dxf'),
                  import('@/src/core/export/csv'),
                  import('@/src/core/export/labels'),
                  import('@/src/core/export/nestingPdf'),
                  import('fflate'),
                ])
                const fonts = await loadFonts()
                const labels = partLabels(panels, catalog, nesting!)
                const entries: Record<string, Uint8Array> = {}
                // Бума ІШІНДЕ бума: цехта раскрой мен присадка әр басқа адамға кетеді.
                for (const [name, content] of flatArchiveFiles(nestingToDxfFiles(nesting!))) {
                  entries[`raskroy/${name}`] = strToU8(content)
                }
                for (const [name, content] of flatArchiveFiles(cabinetToDxfArchiveFiles(panels, dxfOptions))) {
                  entries[`detali/${name}`] = strToU8(content)
                }
                entries['detalirovka.csv'] = strToU8(`\ufeff${cutListToCsv(panels, catalog)}`)
                entries['birki.csv'] = strToU8(`\ufeff${labelsToCsv(labels)}`)
                entries['karta-raskroya.pdf'] = await nestingPdf({ nesting: nesting!, projectName, fonts })
                entries['birki.pdf'] = await labelsPdf({ labels, projectName, fonts, ...labelOptions.value! })
                download(
                  `${projectName}-цех.zip`,
                  zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }),
                  'application/zip',
                )
              })}
            >
              {busy === 'bundle' ? '…' : tr('Пакет для цеха')}
            </Button>
            <Button
              disabled={busy !== null || panels.length === 0 || production.error !== null || !cutExportReady}
              title={tr('Присадка для станка: на каждую деталь свой файл, плюс index.csv')}
              onClick={() => void run('cnc', async () => {
                const [{ cncFiles }, { zipSync, strToU8 }] = await Promise.all([
                  import('@/src/core/export/cnc'),
                  import('fflate'),
                ])
                const entries: Record<string, Uint8Array> = {}
                for (const [name, content] of cncFiles(panels, catalog, { projectName, outerFlipAxis: dxfOptions.settings.outerFlipAxis })) {
                  entries[name] = strToU8(content)
                }
                download(
                  `${projectName}-чпу.zip`,
                  zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }),
                  'application/zip',
                )
              })}
            >
              {busy === 'cnc' ? '…' : tr('ЧПУ по деталям')}
            </Button>
            <Button
              disabled={busy !== null || panels.length === 0 || production.error !== null || !cutExportReady}
              title={tr('Для Базиса: список деталей для Раскроя (CSV, XLSX), скрипт для Мебельщика — детали и присадка как крепёж, DXF деталей')}
              onClick={() => void run('basis', async () => {
                const [{ basisFiles, unsupportedInCp1251 }, { cabinetToDxfArchiveFiles }, { zipSync, strToU8 }] =
                  await Promise.all([
                    import('@/src/core/export/basis'),
                    import('@/src/core/export/dxf'),
                    import('fflate'),
                  ])
                // Скриптке әр корпустың ӨЗ панельдері мен бөлмедегі позасы керек
                // (`basisScript.ts`): присадка Базиске әлем координатасымен барады.
                const scene = flattenTree(root, catalog, settings, layers, autoJoints)
                const options = { projectName, script: { scene, settings } }
                const entries: Record<string, Uint8Array> = {}
                for (const [name, bytes] of basisFiles(panels, catalog, options)) entries[name] = bytes
                for (const [name, content] of flatArchiveFiles(cabinetToDxfArchiveFiles(panels, dxfOptions))) {
                  entries[`dxf/${name}`] = strToU8(content)
                }
                download(
                  `${projectName}-базис.zip`,
                  zipSync(entries, { level: 6, mtime: Date.UTC(1980, 0, 1) }),
                  'application/zip',
                )

                // Базис Windows-1251 оқиды, ал онда қазақ әріптері ЖОҚ.
                // Үнсіз «?» қылып жіберсек, цех детальді танымай қалады.
                const names = [projectName, ...panels.map((p) => p.label)].join(' ')
                const bad = unsupportedInCp1251(names)
                setNotice(bad.length > 0
                  ? `${tr('Базис читает Windows-1251, в ней нет казахских букв')}: ${bad.join(' ')} → «?». ${tr('Переименуйте детали латиницей или по-русски.')}`
                  : null)
              })}
            >
              {busy === 'basis' ? '…' : tr('Базис')}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-4">
        <section className="mb-3 grid gap-2 border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-3" aria-label={tr('Бирки')}>
          <Field label={tr('Лист для бирок')}>
            <Select value={labelPage} onChange={(page) => setLabelPage(page as LabelPage)} options={[
              { value: 'a4', label: 'A4' }, { value: 'a5', label: 'A5' },
            ]} />
          </Field>
          <Field label={tr('Ширина бирки, мм')} hint={`58–${labelSizeLimits(labelPage).width} мм`}>
            <NumberInput value={labelWidth} min={58} max={labelSizeLimits(labelPage).width}
              field="labelWidth" onDraftValidityChange={(field, invalid) => setLabelDraftInvalid((state) => ({ ...state, [field]: invalid }))}
              onChange={setLabelWidth} />
          </Field>
          <Field label={tr('Высота бирки, мм')} hint={`40–${labelSizeLimits(labelPage).height} мм`}>
            <NumberInput value={labelHeight} min={40} max={labelSizeLimits(labelPage).height}
              field="labelHeight" onDraftValidityChange={(field, invalid) => setLabelDraftInvalid((state) => ({ ...state, [field]: invalid }))}
              onChange={setLabelHeight} />
          </Field>
          {labelOptions.error && cloudId !== null ? <p role="alert" className="text-xs text-red-700 sm:col-span-3">{labelOptions.error}</p> : null}
          {!cloudId ? <p className="text-xs text-neutral-600 sm:col-span-3">{tr('Для QR сначала сохраните проект в облаке')}</p> : null}
        </section>
        <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
          {tr('DXF листов — карта раскроя. Пакет для цеха содержит EDGE-DRILLING.csv для торцов; полный CSV присадки — «ЧПУ по деталям».')}
        </p>
        {nested.error ? (
          <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{nested.error}</p>
        ) : null}
        {planned.error ? (
          <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{planned.error}</p>
        ) : null}
        {notice ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-amber-700 dark:text-amber-300">✕</button>
          </div>
        ) : null}

        {!mounted ? (
          <p className="text-xs text-neutral-500">{tr('Загрузка проекта…')}</p>
        ) : !nesting || !plan ? (
          <p className="text-xs text-neutral-500">{tr('Нет деталей для раскроя.')}</p>
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="min-w-0 space-y-3 self-start border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {tr('Настройки станка')}
              </h2>

              <Field label={tr('Материал')} hint={tr('Только видимые карты')}>
                <Select
                  value={materialFilter}
                  onChange={setMaterialFilter}
                  options={[
                    { value: 'all', label: tr('Все материалы') },
                    ...nesting.byMaterial.map((item) => ({ value: item.materialId, label: item.materialName })),
                  ]}
                />
              </Field>

              <Field label={tr('Пропил, мм')} hint={tr('толщина пилы')}>
                <NumberInput
                  value={cutting.kerf}
                  min={0}
                  max={20}
                  field="kerf"
                  onDraftValidityChange={(_field, invalid) => setKerfDraftInvalid(invalid)}
                  onChange={(kerf) => setCutting({ kerf })}
                />
              </Field>

              <Field label={tr('Обрезка, мм')} hint={tr('на сторону')}>
                <Select
                  value={String(cutting.trimEdge ?? TRIM_FROM_MATERIAL)}
                  onChange={(v) => setCutting({ trimEdge: Number(v) === TRIM_FROM_MATERIAL ? null : Number(v) })}
                  options={[
                    { value: String(TRIM_FROM_MATERIAL), label: tr('Как в материале') },
                    ...[0, 5, 10, 15, 20, 25].map((n) => ({ value: String(n), label: `${n} мм` })),
                  ]}
                />
              </Field>

              <Field label={tr('Оптимизация')} hint={tr('глубина поиска')}>
                <Select
                  value={cutting.optimization}
                  onChange={(optimization) => setCutting({ optimization })}
                  options={optimizationOptions()}
                />
              </Field>

              <p className="text-[10px] leading-relaxed text-neutral-500">
                {tr('Настройки принадлежат цеху, а не проекту: они сохраняются в профиле и применяются ко всем расчётам.')}
              </p>
            </aside>

            <div className="min-w-0 space-y-5">
              {advice.length > 0 ? <UnplacedBlock advice={advice} /> : null}

              <Totals stats={plan.stats} sheetCount={nesting.sheetCount} />

              {visibleMaterials(plan.byMaterial, materialFilter).map((m) => {
                const material = nesting.byMaterial.find((x) => x.materialId === m.materialId)!
                return (
                  <section key={m.materialId} className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-sm font-semibold">{material.materialName}</h2>
                      <span className="text-[11px] text-neutral-500 tabular-nums">
                        {material.sheets.length} {tr('л')} · {tr('КИМ')} {m.stats.kim.toFixed(1)}% ·{' '}
                        {tr('резов')} {m.stats.cutCount} · {metres(m.stats.cutLength)} {tr('м')}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-wrap gap-4">
                      {material.sheets.map((sheet) => (
                        <SheetCard
                          key={sheet.index}
                          sheet={sheet}
                          plan={m.sheets.find((s) => s.index === sheet.index)!}
                          showCuts={showCuts}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Totals({ stats, sheetCount }: { stats: CutStats; sheetCount: number }) {
  const cells: { label: string; value: string; hint?: string }[] = [
    { label: tr('Листов'), value: String(sheetCount) },
    { label: tr('КИМ'), value: `${stats.kim.toFixed(1)}%`, hint: tr('деталь / полный лист') },
    { label: tr('Резов'), value: String(stats.cutCount) },
    { label: tr('Длина резов'), value: `${metres(stats.cutLength)} м` },
    { label: tr('Поворотов листа'), value: String(stats.turns) },
    { label: tr('Деловой отход'), value: `${squareMetres(stats.offcutArea)} м²` },
  ]
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">{c.label}</div>
          <div className="text-lg font-semibold tabular-nums">{c.value}</div>
          {c.hint ? <div className="text-[10px] text-neutral-400">{c.hint}</div> : null}
        </div>
      ))}
    </div>
  )
}

/** Рездің түсі: обрезка сұр, бөлу қызыл, өлшемге келтіру қоңыр. */
const CUT_COLOR: Record<CutLine['kind'], string> = {
  trim: '#94a3b8',
  split: '#dc2626',
  size: '#ea580c',
}

function SheetCard({
  sheet, plan, showCuts,
}: { sheet: NestedSheet; plan: SheetCutPlan; showCuts: boolean }) {
  const [playback, setPlayback] = useState(false)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const display = cutDisplay(plan.cuts, showCuts, playback, step)
  useEffect(() => {
    if (!playing || !showCuts || display.step >= display.total) return
    const timer = window.setInterval(() => setStep((current) => playbackStep(current, plan.cuts.length, 1)), 700)
    return () => window.clearInterval(timer)
  }, [playing, showCuts, display.step, display.total, plan.cuts.length])
  useEffect(() => {
    if (display.step >= display.total) setPlaying(false)
  }, [display.step, display.total])
  return (
    <figure className="w-full max-w-[520px] min-w-0 space-y-1">
      <div className="max-w-full overflow-x-auto" aria-label={tr('Карта раскроя')}>
      <svg
        viewBox={`0 0 ${sheet.sheetWidth} ${sheet.sheetHeight}`}
        className="block h-auto w-full min-w-[520px] border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 sm:min-w-0"
        role="img"
        aria-label={`Лист ${sheet.index}`}
      >
        <rect
          x={sheet.usable.x} y={sheet.usable.y}
          width={sheet.usable.width} height={sheet.usable.height}
          fill="none" stroke="#94a3b8" strokeWidth={4} strokeDasharray="18 12"
        />
        {sheet.offcuts.map((o, i) => (
          <rect key={`o${i}`} x={o.x} y={o.y} width={o.width} height={o.height}
            fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeOpacity={0.5} strokeWidth={3} />
        ))}
        {sheet.parts.map((p) => (
          <g key={p.panelId}>
            <rect x={p.x} y={p.y} width={p.width} height={p.height}
              fill="#e3c76a" stroke="#7c5f14" strokeWidth={4} />
            <text
              x={p.x + p.width / 2} y={p.y + p.height / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(34, Math.min(p.width, p.height) * 0.16)}
              fill="#3f3108"
            >
              {panelDisplayLabel(p.label)} {p.width}×{p.height}
            </text>
          </g>
        ))}
        {display.visible.map((c) => {
          const x1 = c.axis === 'v' ? c.at : c.from
          const x2 = c.axis === 'v' ? c.at : c.to
          const y1 = c.axis === 'v' ? c.from : c.at
          const y2 = c.axis === 'v' ? c.to : c.at
          return (
            <g key={c.order}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={CUT_COLOR[c.kind]} strokeWidth={display.active === c ? 12 : 6}
                strokeDasharray={c.kind === 'trim' ? '24 16' : undefined}
                strokeOpacity={display.active === c ? 1 : 0.85}
              />
              <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={30} fill={CUT_COLOR[c.kind]} />
              <text
                x={(x1 + x2) / 2} y={(y1 + y2) / 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={34} fill="#ffffff"
              >
                {c.order}
              </text>
            </g>
          )
        })}
      </svg>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <Button size="sm" active={playback} disabled={!showCuts} ariaPressed={playback}
          onClick={() => { setPlayback(!playback); setPlaying(false); setStep(0) }}>
          {tr('Порядок резов')}
        </Button>
        {playback && showCuts ? <>
          <Button size="sm" disabled={display.step === 0}
            onClick={() => { setPlaying(false); setStep((current) => playbackStep(current, display.total, -1)) }}>
            {tr('Назад')}
          </Button>
          <input type="range" min={0} max={display.total} value={display.step}
            aria-label={tr('Шаг реза')} className="min-w-16 flex-1"
            onChange={(event) => { setPlaying(false); setStep(Number(event.target.value)) }} />
          <span className="tabular-nums">{display.step}/{display.total}</span>
          <Button size="sm" disabled={display.step >= display.total}
            onClick={() => { setPlaying(false); setStep((current) => playbackStep(current, display.total, 1)) }}>
            {tr('Вперёд')}
          </Button>
          <Button size="sm" disabled={display.total === 0}
            onClick={() => { if (display.step >= display.total) setStep(0); setPlaying(!playing) }}>
            {playing ? tr('Пауза') : tr('Воспроизвести')}
          </Button>
        </> : null}
      </div>
      <figcaption className="w-[520px] max-w-full text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {tr('Лист')} {sheet.index}
        </span>{' '}
        · {sheet.sheetWidth}×{sheet.sheetHeight} · {tr('КИМ')}{' '}
        <span className="tabular-nums">{plan.stats.kim.toFixed(1)}%</span> · {tr('резов')}{' '}
        <span className="tabular-nums">{plan.stats.cutCount}</span> ({metres(plan.stats.cutLength)} {tr('м')})
        · {tr('поворотов')} <span className="tabular-nums">{plan.stats.turns}</span>
        {sheet.offcuts.length > 0 ? ` · ${tr('деловой отход')}: ${sheet.offcuts.length}` : ''}
      </figcaption>
    </figure>
  )
}

/**
 * «Не помещается» — және НЕ ІСТЕУ КЕРЕК. Кеңесті ядро есептейді
 * (`unplacedAdvice`), сондықтан ол әрқашан ағымдағы баптаудың сандарымен келеді.
 */
function UnplacedBlock({ advice }: { advice: ReturnType<typeof unplacedAdvice> }) {
  return (
    <div className={cn(
      'space-y-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-900',
      'dark:border-red-900 dark:bg-red-950 dark:text-red-100',
    )}>
      <h2 className="text-sm font-semibold">{tr('Не помещаются на лист')}</h2>
      {advice.map((a) => (
        <div key={a.panelId} className="space-y-1">
          <div className="font-medium">
            {panelDisplayLabel(a.label)} — {a.cutLength}×{a.cutWidth} {tr('мм')}, {tr('лист')} {a.materialName}{' '}
            ({tr('полезно')} {a.usable.width}×{a.usable.height}, {tr('обрезка')} {a.trimEdge} {tr('мм')})
          </div>
          <ul className="list-disc space-y-0.5 pl-5">
            {a.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
