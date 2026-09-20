/**
 * ⚠ УАҚЫТША ДЕМО БЕТ. Докинг жүйесінің (`components/dock/`) өзін көрсету
 * үшін жазылды — нағыз панельдер (Библиотека, Құрылым, Қасиеттер...)
 * `Configurator.tsx`-ке интеграцияланғанда бөлек агент қосады, бұл бет
 * содан кейін алынып тасталуы мүмкін.
 *
 * Не көрсетеді: 4 бос панель қалқымалы күйде ашылады (PRO100-дың әдепкі
 * макетіндей). Тақырып жолағынан сүйреп жиекке апарса — бекиді; бір жиекке
 * екеуін апарса — таб болып жиналады; ✕ жапса — төменгі сол жақтағы мәзірден
 * қайта ашылады; терезе өлшемін өзгертсе — панель экраннан шықпайды.
 */
import { DockHost } from '@/components/dock/DockHost'
import type { DockPanelSpec } from '@/components/dock/DockHost'

function DemoContent({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-[10px] text-neutral-500">{label} — демо мазмұн, тек көрсету үшін.</p>
      <ul className="flex flex-col gap-1">
        {lines.map((l) => (
          <li key={l} className="border border-neutral-800 px-2 py-1 text-[11px] text-neutral-300">
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

const PANELS: DockPanelSpec[] = [
  {
    id: 'library',
    title: 'Библиотека',
    content: <DemoContent label="Библиотека" lines={['Шкаф', 'Тумба', 'Сөре']} />,
  },
  {
    id: 'structure',
    title: 'Құрылым',
    content: <DemoContent label="Құрылым ағашы" lines={['Корпус 1', '  Бүйір', '  Есік']} />,
  },
  {
    id: 'properties',
    title: 'Қасиеттер',
    content: <DemoContent label="Қасиеттер" lines={['H: 2000', 'W: 600', 'D: 450']} />,
  },
  {
    id: 'layers',
    title: 'Қабаттар',
    content: <DemoContent label="Қабаттар" lines={['Корпус', 'Фасад', 'Өлшем сызығы']} />,
  },
]

export const metadata = {
  title: 'Докинг демо (уақытша)',
  description: 'components/dock/ жүйесінің уақытша демо беті — интеграция Configurator.tsx-те бөлек агентте',
}

export default function DockDemoPage() {
  return (
    <div className="h-dvh w-dvw bg-neutral-950">
      <DockHost panels={PANELS}>
        <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-wider text-neutral-700">
          Scene (докингке қатыспайды — PRO100-да бекітілген)
        </div>
      </DockHost>
    </div>
  )
}
