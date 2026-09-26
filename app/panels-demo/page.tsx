/**
 * ⚠ ӨЗ ДЕМО БЕТІМ. Төрт PRO100 панелін (`components/panels/`) докинг
 * жүйесінде (`components/dock/`) көрсетеді.
 *
 * Негізгі экранға (`Configurator.tsx`/`Workspace.tsx`) интеграция — бөлек
 * тапсырма (олар қазір басқа агенттердің қолында). Бұл бет соған дейінгі
 * көрсету/тексеру беті: store-тың әдепкі күйін қолданады (бір шкаф), ешбір
 * форбидден файлды импорттамайды.
 *
 * Не көрсетеді: «Структура» панелінде детальді бас — «Информация» панелі
 * сол детальді көрсетеді (екеуі бір `store.selected`-ты оқиды/жазады).
 * «Размеры» — қосу/өшіру. «Прайс-лист» — смета қысқаша, «Толық смета»
 * батырмасы бар QuoteView-ді ашады.
 */
import { DockHost } from '@/components/dock/DockHost'
import type { DockPanelSpec } from '@/components/dock/DockHost'
import { StructurePanel } from '@/components/panels/StructurePanel'
import { PricePanel } from '@/components/panels/PricePanel'
import { DimensionsPanel } from '@/components/panels/DimensionsPanel'
import { InfoPanel } from '@/components/panels/InfoPanel'

const PANELS: DockPanelSpec[] = [
  { id: 'structure', title: 'Структура проекта', content: <StructurePanel /> },
  { id: 'price', title: 'Прайс-лист', content: <PricePanel /> },
  { id: 'dimensions', title: 'Размеры', content: <DimensionsPanel /> },
  { id: 'info', title: 'Информация', content: <InfoPanel /> },
]

export const metadata = {
  title: 'Панельдер демо',
  description: 'Структура/Прайс-лист/Размеры/Информация — докинг жүйесіндегі төрт панель',
}

export default function PanelsDemoPage() {
  return (
    <div className="h-dvh w-dvw bg-neutral-950">
      <DockHost panels={PANELS}>
        <div className="flex h-full items-center justify-center px-4 text-center text-[11px] uppercase tracking-wider text-neutral-700">
          Scene — бұл бетте жоқ (Scene.tsx тиюге болмайтын файл). Store-тың
          әдепкі шкафы панельдерге деректі осында ешбір 3D-сіз береді.
        </div>
      </DockHost>
    </div>
  )
}
