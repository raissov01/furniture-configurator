'use client'

/**
 * `/dev/thumb` беті: бір шаблонды (не жиынтықты) `ThumbStage`-те салады да,
 * `window.__thumb` арқылы скриптке кадр береді.
 *
 *   await window.__thumb.list()            → [{ kind, id }]
 *   await window.__thumb.shot(kind, id)    → 'data:image/webp;base64,…' (320×240)
 *
 * Бет ешқашан пайдаланушыға көрсетілмейді (`app/dev/thumb/page.tsx`).
 */

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DefaultLoadingManager } from 'three'
import {
  SEED_SETS, SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES, findSet, findTemplate,
  generateCabinet, generateHardware, placementPose, setToProject, templateToCabinet,
} from '@/src/core/index'
import type { CabinetConfig, Catalog, Placement, Room, SettingsOverride } from '@/src/core/index'
import type { SceneItem } from '@/components/Scene'
import { useConfigurator } from '@/store/configurator'

const TemplateGallery = dynamic(() => import('@/components/TemplateGallery').then((m) => m.TemplateGallery), { ssr: false })
const ThumbStage = dynamic(() => import('@/components/ThumbStage').then((m) => m.ThumbStage), { ssr: false })

/** Түсіру өлшемі: 2× — кішірейткенде жиектер тегіс шығады. */
const SHOT_W = 640
const SHOT_H = 480
export const THUMB_W = 320
export const THUMB_H = 240

type Kind = 'template' | 'set'
type Target = { kind: Kind; id: string }

function buildItems(target: Target, catalog: Catalog, settings: SettingsOverride): { items: SceneItem[]; facingY: number } {
  let cabinets: CabinetConfig[]
  let placements: Placement[]
  let room: Room
  if (target.kind === 'set') {
    const set = findSet(target.id)
    if (!set) throw new Error(`жиынтық жоқ: ${target.id}`)
    ;({ cabinets, placements } = setToProject(set, catalog))
    room = { width: set.room.width, depth: set.room.depth, height: set.room.height }
  } else {
    const template = findTemplate(target.id)
    if (!template) throw new Error(`шаблон жоқ: ${target.id}`)
    const cabinet = templateToCabinet(template, catalog)
    cabinets = [cabinet]
    placements = [{ cabinetId: cabinet.id, wall: 'north', offset: 0 }]
    room = { width: Math.max(3000, cabinet.width + 200), depth: 3000, height: 2700 }
  }
  const items = cabinets.map((cabinet): SceneItem => {
    const placement = placements.find((p) => p.cabinetId === cabinet.id)!
    return {
      cabinet,
      panels: generateCabinet(cabinet, catalog, settings),
      hardware: generateHardware(cabinet, catalog, settings),
      placement,
      pose: target.kind === 'set'
        ? placementPose(room, cabinet, placement)
        : { position: { x: 0, y: placement.elevation ?? 0, z: 0 }, rotationY: 0 },
      wallBound: false,
      editable: false,
    }
  })
  return { items, facingY: items[0]?.pose.rotationY ?? 0 }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Текстуралар (TextureLoader → DefaultLoadingManager) жүктеліп біткенше күту. */
async function settle() {
  // Кемінде бір кадр, сосын жүктеу тынышталғанша.
  for (let i = 0; i < 3; i += 1) await nextFrame()
  const started = Date.now()
  while (Date.now() - started < 15000) {
    const { itemsLoaded, itemsTotal } = loaderProgress
    if (itemsLoaded >= itemsTotal) break
    await sleep(100)
  }
  await sleep(250)
}

const loaderProgress = { itemsLoaded: 0, itemsTotal: 0 }
DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  loaderProgress.itemsLoaded = loaded
  loaderProgress.itemsTotal = total
}

export function ThumbStudio() {
  const catalog = useConfigurator((s) => s.catalog)
  const settings = useConfigurator((s) => s.projectSettings ?? s.shop.settings)
  const [target, setTarget] = useState<Target | null>(null)
  // `?gallery` — галереяның өзін ашу (бұрын/кейін скриншоты үшін, бүкіл редакторды жинамай).
  const [gallery, setGallery] = useState(false)
  const setGalleryOpen = useConfigurator((s) => s.setGalleryOpen)
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('gallery')) return
    setGallery(true)
    setGalleryOpen(true)
  }, [setGalleryOpen])
  const framed = useRef<(() => void) | null>(null)
  const invalidateRef = useRef<(() => void) | null>(null)

  const scene = useMemo(() => {
    if (!target) return null
    try {
      return { ...buildItems(target, catalog, settings), error: null }
    } catch (error) {
      return { items: [], facingY: 0, error: error instanceof Error ? error.message : String(error) }
    }
  }, [target, catalog, settings])

  useEffect(() => {
    const api = {
      list: (): Target[] => [
        ...SEED_TEMPLATES.map((t) => ({ kind: 'template' as const, id: t.id })),
        ...STANDARD_NOMENCLATURE_TEMPLATES.map((t) => ({ kind: 'template' as const, id: t.id })),
        ...SEED_SETS.map((s) => ({ kind: 'set' as const, id: s.id })),
      ],
      shot: async (kind: Kind, id: string): Promise<string> => {
        const done = new Promise<void>((resolve) => { framed.current = resolve })
        setTarget({ kind, id })
        await Promise.race([done, sleep(5000)])
        await settle()
        const canvas = document.querySelector<HTMLCanvasElement>('[data-thumb-stage] canvas')
        if (!canvas) throw new Error('canvas жоқ')
        // Текстура келгеннен кейінгі кадр: `demand` режимі өзі салмайды.
        invalidateRef.current?.()
        await nextFrame(); await nextFrame()
        const out = document.createElement('canvas')
        out.width = THUMB_W
        out.height = THUMB_H
        const ctx = out.getContext('2d')!
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(canvas, 0, 0, THUMB_W, THUMB_H)
        return out.toDataURL('image/webp', 0.9)
      },
    }
    ;(window as unknown as { __thumb: typeof api }).__thumb = api
  }, [])

  if (gallery) return <TemplateGallery />

  return (
    <main style={{ padding: 16, background: '#fff', minHeight: '100vh' }}>
      <div data-thumb-stage style={{ width: SHOT_W, height: SHOT_H }}>
        {scene && scene.items.length > 0 ? (
          <ThumbStage
            items={scene.items}
            catalog={catalog}
            settings={settings}
            facingY={scene.facingY}
            onFramed={() => { framed.current?.(); framed.current = null }}
            onInvalidate={(fn) => { invalidateRef.current = fn }}
          />
        ) : null}
      </div>
      <p data-thumb-status style={{ font: '12px monospace' }}>
        {scene?.error ? `ERROR ${scene.error}` : target ? `${target.kind}:${target.id}` : 'idle'}
      </p>
    </main>
  )
}
