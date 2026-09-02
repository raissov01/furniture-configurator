'use client'

/**
 * Локал сақтаулар тарихы.
 *
 * Автосақтау бір ғана кілтке жазады: бетті жауып-ашсаң, соңғы күй қайтады,
 * ал «жарты сағат бұрынғысына» қайта алмайсың. Undo да көмектеспейді —
 * ол бет жаңарғанда жоғалады. Сондықтан жоба өзгерген сайын соңғы бірнеше
 * нұсқа бөлек жазылып тұрады.
 *
 * ⚠ Бұл — БРАУЗЕРДЕГІ тарих, сервердегі емес: басқа компьютерде көрінбейді.
 */

import { t as tr } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { useConfigurator } from '@/store/configurator'

type Entry = { at: number; name: string; json: string }

const HISTORY_KEY = 'furniture-configurator:history'

function read(): Entry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch {
    return []
  }
}

export function HistoryPanel() {
  const open = useConfigurator((s) => s.historyOpen)
  const setOpen = useConfigurator((s) => s.setHistoryOpen)
  const restore = useConfigurator((s) => s.restoreHistory)
  const [entries, setEntries] = useState<Entry[]>([])

  // Тізім терезе АШЫЛҒАНДА оқылады: localStorage-ты үздіксіз бақылаудың
  // қажеті жоқ, ал жабық терезе жадыны да, уақытты да алмауы керек.
  useEffect(() => {
    if (open) setEntries(read())
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{tr('История сохранений')}</h2>
          <span className="text-[11px] text-neutral-500">{tr('в этом браузере')}</span>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="text-xs text-neutral-500">{tr('Пока нет сохранений — история появится по мере работы.')}</p>
        ) : (
          <ul className="space-y-1">
            {entries.map((entry, i) => (
              <li
                key={entry.at}
                className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-700"
              >
                <span className="tabular-nums text-neutral-400">{i + 1}</span>
                <span className="flex-1 truncate">{entry.name}</span>
                <span className="tabular-nums text-[11px] text-neutral-500">
                  {new Date(entry.at).toLocaleString('ru-RU')}
                </span>
                <Button onClick={() => { restore(entry.at); setOpen(false) }}>{tr('Вернуть')}</Button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">
          {tr('Возврат заменяет текущий проект целиком. Ctrl+Z вернёт обратно.')}
        </p>
      </div>
    </div>
  )
}
