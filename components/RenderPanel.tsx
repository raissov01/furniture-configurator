'use client'

/**
 * ИИ-рендер: 3D көрінісінен фотореалистік сурет.
 *
 * ⚠ РЕНДЕР — СУРЕТ, ӨЛШЕМ ЕМЕС. Модель пропорцияны да, түсті де сәл өзгертуі
 * мүмкін, сондықтан терезеде ол туралы ашық жазылады: клиентке жіберер
 * алдында цех оны деталировкамен салыстыруы керек.
 */

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button, Field } from '@/components/ui'
import { useConfigurator } from '@/store/configurator'
import { capturePanorama } from '@/lib/panorama'
import { MaterialAppearanceEditor, ProjectLightsEditor } from '@/components/VisualSettingsPanel'
import { formatTengeExact } from '@/src/core/pricing'
import type { CabinetConfig, Panel } from '@/src/core/types'
import { RENDER_ASPECTS } from '@/src/core/render/prompt'
import type { RenderAspect } from '@/src/core/render/prompt'
import { buildRenderRequest, cropRenderDataUrl } from '@/lib/renderPanelUi'

type HistoryRecord = { id: string; imageUrl: string; createdAt: number; aspect: RenderAspect;
  crop: { x: number; y: number; width: number; height: number }; cost: { tiyn: number } | null }

function buttonStyleForTab(selected: boolean): string {
  return 'border px-2 py-1 text-xs ' + (selected
    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100'
    : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900')
}

export function RenderPanel({ panels, cabinets }: { panels: Panel[]; cabinets: CabinetConfig[] }) {
  const open = useConfigurator((s) => s.renderOpen)
  const setOpen = useConfigurator((s) => s.setRenderOpen)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [style, setStyle] = useState('scandinavian')
  const [aspect, setAspect] = useState<RenderAspect>('1:1')
  const [reference, setReference] = useState<string | null>(null)
  const [referenceName, setReferenceName] = useState('')
  const [cost, setCost] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [image, setImage] = useState<string | null>(null)
  const [panoramaImage, setPanoramaImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'render' | 'material' | 'lights'>('render')
  const catalog = useConfigurator((s) => s.catalog)
  const projectId = useConfigurator((s) => `${s.root.id}:${s.projectName}`.slice(0, 120))

  useEffect(() => {
    if (!open) return
    let live = true
    setHistory([])
    void fetch(`/api/render/history?projectId=${encodeURIComponent(projectId)}`)
      .then(async (response) => response.ok ? await response.json() as { renders: HistoryRecord[] } : null)
      .then((data) => { if (live && data) setHistory(data.renders) })
      .catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : String(cause)) })
    return () => { live = false }
  }, [open, projectId])

  if (!open) return null

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const canvas = document.querySelector('canvas')
      if (!canvas) {
        setError(tr('Сцена ещё не готова'))
        return
      }
      // Скриншот — дәл сол көрініс: адам камераны қалай қойса, солай кетеді.
      const shot = canvas.toDataURL('image/png')
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRenderRequest({ image: shot, hint, style: style as 'scandinavian' | 'modern' | 'loft' | 'classic',
          aspect, reference, panels, cabinets, catalog, projectId })),
      })
      const data = (await res.json()) as { image?: string; error?: string; cost?: { tiyn: number } | null;
        frame?: { crop: { x: number; y: number; width: number; height: number } }; history?: HistoryRecord | null }
      if (!res.ok || !data.image) {
        setError(data.error ?? tr('Не получилось'))
        return
      }
      setImage(data.frame ? await cropRenderDataUrl(data.image, data.frame.crop) : data.image)
      setCost(data.cost?.tiyn ?? null)
      if (data.history) setHistory((current) => [data.history!, ...current.filter((item) => item.id !== data.history!.id)])
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Не получилось'))
    } finally {
      setBusy(false)
    }
  }

  const chooseReference = (file: File | undefined) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError(tr('Фото: PNG, JPEG или WebP до 8 МБ'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReference(reader.result)
        setReferenceName(file.name)
        setError(null)
      }
    }
    reader.onerror = () => setError(tr('Не удалось прочитать фото комнаты'))
    reader.readAsDataURL(file)
  }

  const panorama = () => {
    setBusy(true)
    setError(null)
    // Busy күйі алдымен экранға шықсын, содан кейін алты WebGL кадрын саламыз.
    requestAnimationFrame(() => {
      try {
        const context = useConfigurator.getState().liveRenderContext
        if (!context) throw new Error(tr('Сцена ещё не готова'))
        setPanoramaImage(capturePanorama(context))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : tr('Не удалось создать панораму'))
      } finally { setBusy(false) }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{tr('ИИ-рендер для клиента')}</h2>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <div role="tablist" aria-label={tr('Настройки визуализации')} className="mb-3 flex gap-1 border-b border-neutral-300 pb-2 dark:border-neutral-700">
          {(['render', 'material', 'lights'] as const).map((value) => <button type="button" role="tab"
            aria-selected={tab === value} key={value} className={buttonStyleForTab(tab === value)}
            onClick={() => setTab(value)}>{tr(value === 'render' ? 'Рендер' : value === 'material' ? 'Материал' : 'Свет')}</button>)}
        </div>

        {tab === 'material' ? <MaterialAppearanceEditor /> : null}
        {tab === 'lights' ? <ProjectLightsEditor /> : null}
        {tab === 'render' ? <>

        <p className="mb-3 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          {tr('Рендер — картинка, а не размер: модель может слегка изменить пропорции и цвет. Перед отправкой клиенту сверьте с деталировкой.')}
        </p>

        <Field label={tr('Стиль интерьера')}>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['scandinavian', tr('Скандинавский')],
              ['modern', tr('Современный')],
              ['loft', tr('Лофт')],
              ['classic', tr('Классический')],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                className={
                  'rounded-md border px-2.5 py-1 text-xs transition ' +
                  (style === id
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-neutral-300 hover:border-neutral-500 dark:border-neutral-700')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={tr('Пожелание к обстановке')} hint={tr('необязательно')}>
          <input
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder={tr('кухня в тёплом свете, паркет')}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </Field>

        <Field label={tr('Пропорция кадра')}>
          <div className="flex flex-wrap gap-1" role="group" aria-label={tr('Пропорция кадра')}>
            {RENDER_ASPECTS.map((value) => <Button key={value} active={aspect === value}
              ariaPressed={aspect === value} onClick={() => setAspect(value)}>{value}</Button>)}
          </div>
        </Field>

        <Field label={tr('Фото комнаты для ракурса')} hint={tr('необязательно')}>
          <input type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(event) => { chooseReference(event.target.files?.[0]); event.target.value = '' }}
            className="w-full border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700" />
          {reference && <p className="mt-1 text-xs">{referenceName} · {tr('Только ракурс и композиция')}{' '}
            <Button onClick={() => { setReference(null); setReferenceName('') }}>{tr('Убрать фото')}</Button></p>}
        </Field>

        <div className="mt-3 flex items-center gap-2">
          <Button active disabled={busy} onClick={() => void run()}>
            {busy ? tr('Рисуем…') : image ? tr('Ещё раз') : tr('Сделать рендер')}
          </Button>
          <Button disabled={busy} onClick={panorama}>{tr('Панорама 360°')}</Button>
          {image ? (
            <a
              className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium dark:border-neutral-700"
              href={image}
              download="render.png"
            >
              {tr('Скачать')}
            </a>
          ) : null}
          {panoramaImage ? <a className="border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700"
            href={panoramaImage} download="panorama-360.png">{tr('Скачать панораму')}</a> : null}
        </div>

        {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        {image && <p className="mt-2 text-xs">{tr('Цена одного рендера')}: {cost === null ? tr('Не настроена') : formatTengeExact(cost)}</p>}

        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt={tr('ИИ-рендер')} className="mt-3 w-full rounded-lg" />
        ) : null}
        {panoramaImage ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={panoramaImage} alt={tr('Панорама 360°')}
          className="mt-3 w-full border border-neutral-300 dark:border-neutral-700" /> : null}
        {history.length > 0 && <div className="mt-4 border-t border-neutral-300 pt-3 dark:border-neutral-700">
          <h3 className="mb-2 text-xs font-semibold">{tr('История рендеров')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {history.map((record) => <button type="button" key={record.id}
              onClick={() => { void cropRenderDataUrl(record.imageUrl, record.crop)
                .then((url) => { setImage(url); setCost(record.cost?.tiyn ?? null) })
                .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause))) }}
              className="border border-neutral-300 p-1 text-left text-[10px] dark:border-neutral-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={record.imageUrl} alt={tr('ИИ-рендер')} className="mb-1 aspect-square w-full object-cover" />
              {record.aspect} · {new Date(record.createdAt).toLocaleDateString()}
            </button>)}
          </div>
        </div>}
        </> : null}
      </div>
    </div>
  )
}
