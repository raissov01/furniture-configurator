/**
 * ⚠ ӨЗ ДЕМО БЕТІМ. «Замена» мен «Найти» панельдерін (`components/panels/`)
 * докинг жүйесінде (`components/dock/`) көрсетеді.
 *
 * Негізгі экранға (`Configurator.tsx`/`Workspace.tsx`) интеграция — бөлек
 * тапсырма (олар қазір басқа агенттердің қолында). Бұл бет соған дейінгі
 * көрсету/тексеру беті: store-тың әдепкі күйін қолданады (бір шкаф), ешбір
 * форбидден файлды импорттамайды (`app/panels-demo/page.tsx`-тегі басқа
 * агенттің үлгісімен БІРДЕЙ тәсіл — сол файлды тимей, өз бетімді аштым).
 *
 * Не көрсетеді: «Замена» — қолданылған материалдар тізімі, жаңа материал,
 * ауқым (бүкіл жоба / таңдалған корпус), алдын ала көрсету (деталь саны,
 * баға айырмасы), «Заменить» батырмасы. «Найти» — деталь атауы/материалы/
 * өлшемі бойынша іздеу, нәтижені басқанда `store.selected` қойылады
 * (3D бөлектеу `PanelMesh.tsx`-тегі бар механизммен, бұл бетте Scene жоқ
 * болса да store дұрыс жаңарады — Workspace/Scene қосылған бетте көрінеді).
 */
import { DockHost } from '@/components/dock/DockHost'
import type { DockPanelSpec } from '@/components/dock/DockHost'
import { ReplacePanel } from '@/components/panels/ReplacePanel'
import { FindPanel } from '@/components/panels/FindPanel'

const PANELS: DockPanelSpec[] = [
  { id: 'replace', title: 'Замена', content: <ReplacePanel /> },
  { id: 'find', title: 'Найти', content: <FindPanel /> },
]

export const metadata = {
  title: 'Замена / Найти демо',
  description: 'Материалды жаппай ауыстыру мен жоба бойынша іздеу — докинг жүйесіндегі екі панель',
}

export default function ReplaceFindDemoPage() {
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
