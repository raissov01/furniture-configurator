/**
 * ⚠ УАҚЫТША ДЕМО БЕТ. `components/panels/ImportPanel.tsx`-ті докинг
 * жүйесінде (`components/dock/`) көрсету үшін жазылды — көзбен тексеру
 * үшін ғана (screenshot). `app/dock-demo/page.tsx`-ке ТИМЕЙДІ, ол басқа
 * агенттің демосы.
 */
import { DockHost } from '@/components/dock/DockHost'
import type { DockPanelSpec } from '@/components/dock/DockHost'
import { ImportPanel } from '@/components/panels/ImportPanel'

const PANELS: DockPanelSpec[] = [
  {
    id: 'import',
    title: 'Импорт DXF',
    content: <ImportPanel />,
  },
]

export const metadata = {
  title: 'DXF импорт демо (уақытша)',
  description: 'ImportPanel.tsx компонентінің уақытша демо беті — көзбен тексеру үшін',
}

export default function DxfImportDemoPage() {
  return (
    <div className="h-dvh w-dvw bg-neutral-950">
      <DockHost panels={PANELS}>
        <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-wider text-neutral-700">
          Scene (докингке қатыспайды)
        </div>
      </DockHost>
    </div>
  )
}
