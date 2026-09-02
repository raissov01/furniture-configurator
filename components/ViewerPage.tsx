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
import { ConfigValidationError, decodeProject } from '@/src/core/index'
import type { ProjectFile } from '@/src/core/index'
import { useConfigurator } from '@/store/configurator'
import type { CameraPreset } from '@/store/configurator'
import { useSceneItems } from '@/lib/useSceneItems'
import { Button } from '@/components/ui'

// R3F тек браузерде жүреді: серверде рендерлеуге әрекет етсек, бет құлайды.
const Scene = dynamic(() => import('@/components/Scene'), { ssr: false })

/** Клиентке керегі осы үшеуі: жалпы көрініс, фас және бөлме. */
const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'three-quarter', label: '3/4' },
  { value: 'front', label: tr('Фас') },
  { value: 'room', label: tr('Комната') },
]

export function ViewerPage() {
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ready'; project: ProjectFile } | { kind: 'error'; message: string }
  >({ kind: 'loading' })

  const loadProject = useConfigurator((s) => s.loadProject)
  const setCameraPreset = useConfigurator((s) => s.setCameraPreset)
  const cameraPreset = useConfigurator((s) => s.cameraPreset)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      setState({ kind: 'error', message: 'В ссылке нет проекта. Попросите отправить её целиком.' })
      return
    }
    try {
      const project = decodeProject(hash)
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
  }, [loadProject])

  return state.kind === 'ready'
    ? <Viewer project={state.project} preset={cameraPreset} setPreset={setCameraPreset} />
    : <Notice state={state} />
}

function Notice({ state }: { state: { kind: 'loading' } | { kind: 'error'; message: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-200">
      <div className="max-w-md space-y-3 text-center">
        {state.kind === 'loading' ? (
          <p className="text-sm text-neutral-400">{tr('Открываем проект…')}</p>
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
  project, preset, setPreset,
}: {
  project: ProjectFile
  preset: CameraPreset
  setPreset: (v: CameraPreset) => void
}) {
  const room = useConfigurator((s) => s.room)
  const cabinets = useConfigurator((s) => s.cabinets)
  const placements = useConfigurator((s) => s.placements)
  const catalog = useConfigurator((s) => s.catalog)
  const activeId = useConfigurator((s) => s.activeId)
  const openness = useConfigurator((s) => s.openness)
  const setOpenness = useConfigurator((s) => s.setOpenness)

  const items = useSceneItems(room, cabinets, placements, catalog)

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
        <div className="ml-auto flex items-center gap-1">
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
        <div className="absolute inset-0">
          <Scene items={items} room={room} activeId={activeId} catalog={catalog} />
        </div>
      </div>

      <section className="max-h-[30vh] overflow-auto border-t border-neutral-800 px-4 py-3">
        <table className="w-full text-xs">
          <thead className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-1 font-medium">{tr('Корпус')}</th>
              <th className="py-1 font-medium">{tr('Размер, H × W × D')}</th>
              <th className="py-1 font-medium">{tr('Корпус')}</th>
              <th className="py-1 font-medium">{tr('Фасад')}</th>
            </tr>
          </thead>
          <tbody>
            {cabinets.map((c) => (
              <tr key={c.id} className="border-t border-neutral-900">
                <td className="py-1">{c.name}</td>
                <td className="py-1 tabular-nums text-neutral-400">
                  {c.height} × {c.width} × {c.depth}
                </td>
                <td className="py-1 text-neutral-400">{materialName(c.carcassMaterialId)}</td>
                <td className="py-1 text-neutral-400">{materialName(c.frontMaterialId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
