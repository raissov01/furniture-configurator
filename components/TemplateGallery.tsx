'use client'

/**
 * Дайын шаблондар галереясы (A6). «Таңдадың → размерін өзгерттің → болды»
 * ағынының бірінші қадамы.
 */

import { useMemo, useState } from 'react'
import { SEED_TEMPLATES, TEMPLATE_CATEGORIES, templateToCabinet } from '@/src/core/index'
import type { TemplateCategory } from '@/src/core/index'
import { catalog } from '@/lib/defaults'
import { useConfigurator } from '@/store/configurator'
import { CabinetThumb } from '@/components/CabinetThumb'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

type Filter = TemplateCategory | 'all'

/** Ең биік шаблон карточкада осынша пиксель болады. */
const THUMB_MAX_PX = 104
const TALLEST_MM = Math.max(...SEED_TEMPLATES.map((t) => t.height))

/**
 * Масштаб ТУРА пропорционал емес, түбір арқылы қысылған. Таза пропорцияда
 * 400 мм антресоль 2200 мм шкафтың жанында 19 пиксель болып, суреті мүлде
 * оқылмай қалады; ал бірдей биіктікте берсек өлшем сезімі жоғалады.
 * Түбір екеуінің ортасын береді: биігірегі әрқашан биік көрінеді, кішісі
 * әлі де оқылады. Нақты сандар карточкада мәтінмен қатар тұр.
 */
const thumbScale = (heightMm: number) =>
  (THUMB_MAX_PX * Math.sqrt(heightMm / TALLEST_MM)) / heightMm

export function TemplateGallery() {
  const open = useConfigurator((s) => s.galleryOpen)
  const setOpen = useConfigurator((s) => s.setGalleryOpen)
  const loadTemplate = useConfigurator((s) => s.loadTemplate)
  const activeId = useConfigurator((s) => s.templateId)
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(
    () => (filter === 'all' ? SEED_TEMPLATES : SEED_TEMPLATES.filter((t) => t.category === filter)),
    [filter],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-5xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">Готовые шаблоны</h2>
          <Button active={filter === 'all'} onClick={() => setFilter('all')}>Все</Button>
          {TEMPLATE_CATEGORIES.map((c) => (
            <Button key={c.value} active={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </Button>
          ))}
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>Закрыть</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => loadTemplate(t.id)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition',
                'hover:border-neutral-500 hover:shadow-sm',
                t.id === activeId
                  ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-700',
              )}
            >
              <div
                className="flex w-full items-end justify-center overflow-hidden"
                style={{ height: THUMB_MAX_PX }}
              >
                <CabinetThumb cabinet={templateToCabinet(t, catalog)} catalog={catalog} pxPerMm={thumbScale(t.height)} />
              </div>
              <div className="text-xs font-medium">{t.name}</div>
              <div className="tabular-nums text-[11px] text-neutral-500">
                {t.height} × {t.width} × {t.depth}
              </div>
              <div className="text-[11px] leading-snug text-neutral-400">{t.description}</div>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-neutral-400">
          Шаблон полностью заменяет текущий корпус. Ctrl+Z возвращает предыдущий.
        </p>
      </div>
    </div>
  )
}
