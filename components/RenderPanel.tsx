'use client'

/**
 * ИИ-рендер: 3D көрінісінен фотореалистік сурет.
 *
 * ⚠ РЕНДЕР — СУРЕТ, ӨЛШЕМ ЕМЕС. Модель пропорцияны да, түсті де сәл өзгертуі
 * мүмкін, сондықтан терезеде ол туралы ашық жазылады: клиентке жіберер
 * алдында цех оны деталировкамен салыстыруы керек.
 */

import { useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button, Field } from '@/components/ui'
import { useConfigurator } from '@/store/configurator'

export function RenderPanel() {
  const open = useConfigurator((s) => s.renderOpen)
  const setOpen = useConfigurator((s) => s.setRenderOpen)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const canvas = document.querySelector('canvas')
      if (!canvas) {
        setError(tr('Сцена ещё не готова'))
        return
      }
      // Скриншот — дәл сол көрініс: адам камераны қалай қойса, солай кетеді.
      const shot = canvas.toDataURL('image/png')
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: shot, hint }),
      })
      const data = (await res.json()) as { image?: string; error?: string }
      if (!res.ok || !data.image) {
        setError(data.error ?? tr('Не получилось'))
        return
      }
      setImage(data.image)
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Не получилось'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{tr('ИИ-рендер для клиента')}</h2>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        <p className="mb-3 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          {tr('Рендер — картинка, а не размер: модель может слегка изменить пропорции и цвет. Перед отправкой клиенту сверьте с деталировкой.')}
        </p>

        <Field label={tr('Пожелание к обстановке')} hint={tr('необязательно')}>
          <input
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder={tr('кухня в тёплом свете, паркет')}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </Field>

        <div className="mt-3 flex items-center gap-2">
          <Button active disabled={busy} onClick={() => void run()}>
            {busy ? tr('Рисуем…') : image ? tr('Ещё раз') : tr('Сделать рендер')}
          </Button>
          {image ? (
            <a
              className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium dark:border-neutral-700"
              href={image}
              download="render.png"
            >
              {tr('Скачать')}
            </a>
          ) : null}
        </div>

        {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt={tr('ИИ-рендер')} className="mt-3 w-full rounded-lg" />
        ) : null}
      </div>
    </div>
  )
}
