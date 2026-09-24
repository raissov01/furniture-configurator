'use client'

/**
 * Клиент көретін бет. Тек ҚАРАУҒА: өзгертетін ештеңе жоқ.
 *
 * ЖОБА URL-ДІҢ ХЕШІНДЕ келеді, сервер оны МҮЛДЕ КӨРМЕЙДІ. Сондықтан мұнда
 * цехтың ішкі құжаттары — смета, раскрой, деталировка — ӘДЕЙІ ЖОҚ: клиент
 * жиһаздың өзін көреді, ал цехтың өзіндік құны оның ісі емес.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ConfigValidationError, decodeProjectV4, parseProjectV4 } from '@/src/core/index'
import type { ProjectFileV4 } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'
import { useTreeSceneItems } from '@/lib/useTreeSceneItems'
import { Button } from '@/components/ui'
import { Spinner } from '@/components/BusyOverlay'
import { TouchJoystick } from '@/components/TouchJoystick'
import { isTouchDevice } from '@/lib/walkInput'
import { ClientComments } from '@/components/ClientComments'
import { formatTenge } from '@/src/core/index'

// R3F тек браузерде жүреді: серверде рендерлеуге әрекет етсек, бет құлайды.
// Жүктелгенше «жүктелуде» шеңбері — клиент бет қатып қалды деп ойламасын.
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner label={tr('Загрузка 3D…')} onDark />
    </div>
  ),
})

/** Клиентке керегі осы үшеуі: жалпы көрініс, фас және бөлме. */
const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'three-quarter', label: '3/4' },
  { value: 'front', label: tr('Фас') },
  { value: 'room', label: tr('Комната') },
]

/** Кодпен ашылған жобаны серверден қайта тексеру аралығы, мс (автожаңарту). */
const SHARE_POLL_MS = 5000

export function ViewerPage() {
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; project: ProjectFileV4 } | { kind: 'error'; message: string }
  >({ kind: 'loading' })

  const loadProject = useConfigurator((s) => s.loadProject)
  const setCameraPreset = useConfigurator((s) => s.setCameraPreset)
  const cameraPreset = useConfigurator((s) => s.cameraPreset)

  useEffect(() => {
    // Кодпен ашылса (`/view?c=123456`) — төмендегі эффект; мұнда тек хеш.
    if (new URLSearchParams(window.location.search).get('c')) return undefined
    const hash = window.location.hash.slice(1)
    if (!hash) {
      setState({ kind: 'error', message: 'В ссылке нет проекта. Попросите отправить её целиком.' })
      return undefined
    }
    try {
      const project = decodeProjectV4(hash)
      loadProject(project)
      setState({ kind: 'ready', project })
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof ConfigValidationError
          ? `${error.message}${error.allowed ? ` — ${error.allowed}` : ''}`
          : 'Не удалось открыть проект по этой ссылке.',
      })
    }
    return undefined
  }, [loadProject])

  /*
   * КОДПЕН АШУ (qdesign «3D-көріністе ашу» сияқты): жоба серверден келеді
   * әрі SHARE_POLL_MS сайын тексеріледі — цех өзгертсе, клиенттің экраны
   * өзі жаңарады («Автоматты жаңарту»). Өзгермесе — ештеңе қайта салынбайды.
   */
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('c')
    if (!code) return undefined
    let alive = true
    let seen = 0
    const pull = async (first: boolean) => {
      const res = await fetch(`/api/share/${encodeURIComponent(code)}`, { cache: 'no-store' }).catch(() => null)
      if (!alive) return
      if (!res || !res.ok) {
        if (first) {
          setState({
            kind: 'error',
            message: res?.status === 404
              ? 'Код не найден или его срок истёк: код действует 24 часа. Попросите у мастера новый.'
              : 'Не удалось открыть проект по коду. Проверьте интернет.',
          })
        }
        return
      }
      const data = (await res.json()) as { project: unknown; updatedAt: number }
      if (!alive || data.updatedAt === seen) return
      seen = data.updatedAt
      try {
        const project = parseProjectV4(data.project)
        loadProject(project)
        setState({ kind: 'ready', project })
      } catch (error) {
        if (first) {
          setState({
            kind: 'error',
            message: error instanceof ConfigValidationError ? error.message : 'Проект по коду не прочитался.',
          })
        }
      }
    }
    void pull(true)
    const timer = setInterval(() => { void pull(false) }, SHARE_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [loadProject])

  return state.kind === 'ready'
    ? <Viewer project={state.project} preset={cameraPreset} setPreset={setCameraPreset}
      code={new URLSearchParams(window.location.search).get('c')} />
    : <Notice state={state} />
}

function Notice({ state }: { state: { kind: 'loading' } | { kind: 'error'; message: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-200">
      <div className="max-w-md space-y-3 text-center">
        {state.kind === 'loading' ? (
          <Spinner label={tr('Открываем проект…')} onDark />
        ) : (
          <>
            <h1 className="text-lg font-semibold">{tr('Ссылка не открылась')}</h1>
            <p className="text-sm text-neutral-400">{state.message}</p>
            <Link href="/" className="inline-block text-sm text-sky-400 underline">{tr('На главную')}</Link>
          </>
        )}
      </div>
    </main>
  )
}

function Viewer({
  project, preset, setPreset, code,
}: {
  project: ProjectFileV4
  preset: CameraPreset
  setPreset: (v: CameraPreset) => void
  code: string | null
}) {
  const room = useConfigurator((s) => s.room)
  const root = useConfigurator((s) => s.root)
  const layers = useConfigurator((s) => s.layers)
  const projectSettings = useConfigurator((s) => s.projectSettings)
  const shopSettings = useConfigurator((s) => s.shop.settings)
  const catalog = useConfigurator((s) => s.catalog)
  const activeId = useConfigurator((s) => s.activeId)
  const openness = useConfigurator((s) => s.openness)
  const setOpenness = useConfigurator((s) => s.setOpenness)
  // ПРОГУЛКА клиентке де (qdesign-да клиент сілтемемен/кодпен жүре алады).
  const walk = useConfigurator((s) => s.walk)
  const setWalk = useConfigurator((s) => s.setWalk)
  const touch = useMemo(isTouchDevice, [])

  const { scene, items, error } = useTreeSceneItems(root, room, catalog, projectSettings ?? shopSettings, layers)
  const cabinets = items.map((item) => item.cabinet)

  const materialName = useMemo(() => {
    const byId = new Map(catalog.materials.map((m) => [m.id, m.name]))
    return (id: string) => byId.get(id) ?? id
  }, [catalog])

  return (
    <main className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-800 px-4 py-2">
        <span className="text-sm font-semibold">{project.name}</span>
        <span className="text-xs text-neutral-500">
          {cabinets.length === 1 ? '1 корпус' : `${cabinets.length} корпуса`}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button active={walk} onClick={() => setWalk(!walk)}>{tr('Прогулка')}</Button>
          {/* Клиент үшін ЕҢ түсінікті батырма: ашылған есік пен шығарылған
              ящик жиһаздың ішін де, өлшемін де сөзсіз түсіндіреді. */}
          <Button active={openness > 0} onClick={() => setOpenness(openness > 0 ? 0 : 1)}>
            {openness > 0 ? tr('Закрыть створки') : tr('Распахнуть')}
          </Button>
          {PRESETS.map((p) => (
            <Button key={p.value} active={preset === p.value} onClick={() => setPreset(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {error ? <div role="alert" className="absolute inset-x-0 top-0 z-10 bg-red-950 px-4 py-2 text-sm text-red-100">
          {error.message}
        </div> : null}
          <div className="absolute inset-0">
          <Scene items={items} room={room} activeId={activeId} catalog={catalog}
            flatScene={scene} allowDimensionLabels={false} />
          </div>
        {walk ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900/90 px-4 py-2 text-xs text-white">
                <span>{touch
                  ? tr('Джойстик — идти · проведите пальцем — осмотр · коснитесь дверцы — открыть')
                  : tr('Кликните для обзора · WASD — идти · E — дверцы · Esc — курсор')}</span>
                <button
                  type="button"
                  className="rounded-full border border-white/40 px-2.5 py-1 hover:bg-white/15"
                  onClick={() => setWalk(false)}
                >
                  {tr('Выйти')}
                </button>
              </div>
            </div>
            {touch ? <TouchJoystick /> : null}
          </>
        ) : null}
      </div>

      <section className="max-h-[20vh] overflow-auto border-t border-neutral-800 px-4 py-3 text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {cabinets.map((cabinet) => (
            <p key={cabinet.id}>
              <span className="font-medium">{cabinet.name}</span>
              <span className="ml-2 text-neutral-400">{materialName(cabinet.carcassMaterialId)} · {materialName(cabinet.frontMaterialId)}</span>
            </p>
          ))}
          <p className="ml-auto font-medium">{project.priceOverrides?.salePrice !== undefined
            ? formatTenge(project.priceOverrides.salePrice) : tr('Цена по запросу')}</p>
        </div>
      </section>
      {code ? <ClientComments code={code} objects={cabinets.map((cabinet) => ({ id: cabinet.id, name: cabinet.name }))} /> : null}
    </main>
  )
}
