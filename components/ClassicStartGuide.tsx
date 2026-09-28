'use client'

/**
 * «Начало работы» — PRO100 пайдаланушысына таныс үш қадам, сахнаның үстінде
 * шағын терезе (жұмысты бұғаттамайды): 1) Свойства помещения, 2) Библиотека →
 * Мебель, 3) модульді екі рет басып қою. Жабуға болады; «Справка → Начало
 * работы» қайта ашады.
 */

import { t as tr } from '@/lib/i18n'
import { useClassicView } from '@/store/classicView'
import { ClassicWindowIcon } from '@/components/ClassicWindow'

export function ClassicStartGuide({ onRoom, onLibrary }: { onRoom: () => void; onLibrary: () => void }) {
  const open = useClassicView((s) => s.startGuideOpen)
  const close = useClassicView((s) => s.setStartGuideOpen)
  if (!open) return null
  return <section className="p100-start-guide" role="dialog" aria-label={tr('Начало работы')} data-testid="classic-start-guide">
    <header className="p100-window-title">
      <ClassicWindowIcon />
      <strong>{tr('Начало работы')}</strong>
      <button type="button" aria-label={tr('Закрыть')} title={tr('Закрыть')} onClick={() => close(false)}>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1 1 9" stroke="currentColor" strokeWidth="1.1" /></svg>
      </button>
    </header>
    <ol>
      <li><span>{tr('Задайте размеры комнаты')}</span>
        <button type="button" className="p100-window-button" onClick={onRoom}>{tr('Свойства помещения…')}</button></li>
      <li><span>{tr('Откройте библиотеку и выберите папку «Мебель»')}</span>
        <button type="button" className="p100-window-button" onClick={onLibrary}>{tr('Библиотека')}</button></li>
      <li><span>{tr('Двойной щелчок по модулю ставит его в комнату. Двойной щелчок по модулю в 3D открывает «Свойства».')}</span></li>
    </ol>
  </section>
}
