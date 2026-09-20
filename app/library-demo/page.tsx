/**
 * ⚠ УАҚЫТША ДЕМО БЕТ. «Библиотека» панелін (`components/panels/LibraryPanel.tsx`)
 * докинг жүйесінің ішінде көрсету үшін жазылды — `app/dock-demo/page.tsx`-ке
 * ТИМЕДІМ (ол ортақ, басқа агент те қолдануы мүмкін), сондықтан бөлек бет.
 *
 * Негізгі экранға (`Configurator.tsx`) интеграцияны орчестратор өзі жасайды
 * (тапсырмада көрсетілген) — бұл бет тек көзбен тексеру үшін.
 */
import { DockHost } from '@/components/dock/DockHost'
import type { DockPanelSpec } from '@/components/dock/DockHost'
import { LibraryPanel } from '@/components/panels/LibraryPanel'

const PANELS: DockPanelSpec[] = [
  {
    id: 'library',
    title: 'Библиотека',
    content: <LibraryPanel />,
  },
]

export const metadata = {
  title: 'Библиотека панелінің демосы (уақытша)',
  description: 'components/panels/LibraryPanel.tsx-ты dock жүйесінде көрсету үшін',
}

export default function LibraryDemoPage() {
  return (
    <div className="h-dvh w-dvw bg-neutral-950">
      <DockHost panels={PANELS}>
        <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-wider text-neutral-700">
          Scene (демо үшін бос)
        </div>
      </DockHost>
    </div>
  )
}
