'use client'

/**
 * Бір панельдің қабығы: тақырып жолағы (сүйреу тұтқасы), жабу ✕, мазмұн,
 * қалқымалы кезде — өлшем өзгерту тұтқасы.
 *
 * ⚠ ЕҢ МАҢЫЗДЫ ЕРЕЖЕ (components/ui.tsx-тегі Collapsible-мен бірдей):
 * `hidden === true` болғанда балалар DOM-нан АЛЫНБАЙДЫ, тек CSS класымен
 * жасырылады (`hidden` класы vs `flex`). Tailwind-тың `[hidden]` ережесі
 * `:where()` ішінде тұр (салмағы 0), ал `flex` одан ауыр, сондықтан HTML
 * `hidden` атрибутын емес, класты қолданамыз. Шартты рендер
 * (`hidden ? null : <div>...`) қолдануға БОЛМАЙДЫ — e2e соқыр болып қалады.
 */
import * as React from 'react'
import { cn } from '@/lib/cn'
import { t as tr } from '@/lib/i18n'
import type { FloatingRect } from './types'

export function DockPanel({
  title,
  floatingRect,
  zIndex,
  hidden,
  onClose,
  onTitlePointerDown,
  onResizePointerDown,
  onFocus,
  testId,
  children,
}: {
  title: React.ReactNode
  /** Берілсе — панель қалқымалы әрі абсолютті позицияланады. Берілмесе — докталған, орналасуын DockHost шешеді. */
  floatingRect?: FloatingRect
  /** Қалқымалы панельдердің қабаттасу реті. */
  zIndex?: number
  /** Панель жабық немесе белсенді емес таб — DOM-да қалады, тек көрінбейді (жоғарыдағы ⚠-ні қара). */
  hidden: boolean
  onClose: () => void
  onTitlePointerDown: (e: React.PointerEvent) => void
  onResizePointerDown?: (e: React.PointerEvent) => void
  onFocus?: () => void
  /** e2e үшін тұрақты хук: `data-dock-panel`. */
  testId: string
  children: React.ReactNode
}) {
  return (
    <div
      data-dock-panel={testId}
      data-dock-hidden={hidden ? 'true' : 'false'}
      onPointerDownCapture={onFocus}
      className={cn(
        'p100-dock-panel flex-col overflow-hidden border',
        hidden ? 'hidden' : 'flex',
        floatingRect ? 'absolute' : 'h-full w-full',
      )}
      style={
        floatingRect
          ? { left: floatingRect.x, top: floatingRect.y, width: floatingRect.width, height: floatingRect.height, zIndex }
          : undefined
      }
    >
      <div
        className="p100-dock-title flex shrink-0 cursor-move touch-none select-none items-center gap-2 border-b px-2 py-1 text-[11px] font-semibold"
        onPointerDown={onTitlePointerDown}
      >
        <span className="flex-1 truncate">{title}</span>
        <button
          type="button"
          className="p100-dock-close px-1"
          aria-label={tr('Закрыть')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="p100-dock-body flex-1 overflow-auto p-2 text-xs">{children}</div>
      {floatingRect && onResizePointerDown ? (
        <div
          className="p100-dock-resize absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize touch-none border-b border-r"
          onPointerDown={onResizePointerDown}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
