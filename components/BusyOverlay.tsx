'use client'

/**
 * «ЖҮКТЕЛУДЕ…» — ауыр әрекет кезінде бүкіл интерфейстің үстіндегі жабын.
 *
 * qdesign сияқты (09-13-те олардың бетінен көрілді): интерфейс ағарып
 * қалады, ортасында айналатын шеңбер мен жазу. Онсыз гарнитурды құрастыру
 * бірнеше секунд бетті қатырады да, адам «бет тоқтап қалды ма» деп ойлайды.
 *
 * Жалпақ дизайн: тұтас жартылай мөлдір түс, blur да, градиент те жоқ.
 */

import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
      <span className="text-sm text-neutral-700 dark:text-neutral-200">{label}</span>
    </div>
  )
}

export function BusyOverlay() {
  const busy = useConfigurator((s) => s.busy)
  if (!busy) return null
  return (
    <div
      data-busy
      className="fixed inset-0 z-[80] flex items-center justify-center bg-white/70 dark:bg-neutral-950/70"
    >
      <Spinner label={busy || tr('Загрузка…')} />
    </div>
  )
}
