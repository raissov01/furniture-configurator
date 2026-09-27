'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { mapImportedTexture, pro100TextureImports } from '@/lib/ownTextureUi'
import type { OwnTextureEntry } from '@/lib/ownTextureUi'
import { useConfigurator } from '@/store/configurator'

const inputClass = 'w-full min-w-0 border border-neutral-400 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900'

/** `textures.ini` тек метадерек; сурет пен жоба материалы осы жерде айқын жұпталады. */
export function OwnTextureMapper() {
  const materials = useConfigurator((state) => state.catalog.materials)
  const setMaterialDecor = useConfigurator((state) => state.setMaterialDecor)
  const [entries, setEntries] = useState<OwnTextureEntry[]>([])
  const [selected, setSelected] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reload = async (signal?: AbortSignal) => {
    const response = await fetch('/api/own-catalog', signal ? { signal } : {})
    if (!response.ok) throw new Error(response.status === 401 ? tr('Для импорта нужен вход в аккаунт') : tr('Не удалось загрузить текстуры цеха'))
    const body = await response.json() as { imports?: unknown }
    if (!signal?.aborted) {
      setEntries(pro100TextureImports(body.imports))
      setSelected(''); setFile(null); setMessage(null); setError(null)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr('Не удалось загрузить текстуры цеха'))
    })
    return () => controller.abort()
  }, [])

  const entry = entries[Number(selected)]
  const submit = async () => {
    if (!entry || !materialId || !file || !rights || busy) return
    setBusy(true); setError(null); setMessage(null)
    try {
      const params = new URLSearchParams({ importId: entry.importId, textureName: entry.texture.name })
      const response = await fetch(`/api/own-catalog/image?${params}`, { method: 'POST', body: file,
        headers: { 'Content-Type': file.type, 'x-rights-confirmed': 'true' } })
      const body = await response.json() as { url?: string; error?: string }
      if (!response.ok || !body.url) throw new Error(body.error ?? tr('Не удалось загрузить изображение'))
      const material = materials.find((candidate) => candidate.id === materialId)
      if (!material) throw new Error(tr('Выберите материал проекта'))
      const mapped = mapImportedTexture(material, entry.texture, body.url)
      setMaterialDecor(material.id, mapped.decor)
      setMessage(tr('Текстура применена к материалу проекта'))
      setFile(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось применить текстуру')) }
    finally { setBusy(false) }
  }

  return <section className="space-y-2 border border-neutral-300 p-3 dark:border-neutral-700" aria-label={tr('Текстуры PRO100')}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{tr('Текстуры PRO100')}</h3>
      <button type="button" className="border border-neutral-400 px-2 py-1 text-xs dark:border-neutral-700"
        onClick={() => void reload().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : tr('Не удалось загрузить текстуры цеха')))}>
        {tr('Обновить список')}
      </button>
    </div>
    <p className="text-xs text-neutral-500">{tr('INI содержит только размеры и имя файла. Загрузите само изображение и выберите материал проекта.')}</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs">{tr('Текстура из импорта')}
        <select className={inputClass} value={selected} onChange={(event) => { setSelected(event.target.value); setFile(null); setMessage(null) }}>
          <option value="">{tr('Выберите текстуру')}</option>
          {entries.map((item, index) => <option key={`${item.importId}:${item.texture.name}`} value={index}>
            {item.texture.name} — {item.texture.mapSizeMm.x} × {item.texture.mapSizeMm.y} {tr('мм')}
          </option>)}
        </select>
      </label>
      <label className="text-xs">{tr('Материал проекта')}
        <select className={inputClass} value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
          <option value="">{tr('Выберите материал проекта')}</option>
          {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
        </select>
      </label>
    </div>
    {entry?.texture.imageFile && <p className="text-xs text-neutral-500">{tr('Имя файла в INI')}: {entry.texture.imageFile}</p>}
    <label className="block text-xs">{tr('Файл изображения PNG, JPEG или WebP (до 1 МБ)')}
      <input className={inputClass} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        setFile(event.target.files?.[0] ?? null)
        event.currentTarget.value = ''
      }} />
      {file && <span className="block text-neutral-500">{file.name}</span>}
    </label>
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
      {tr('Подтверждаю право использовать это изображение в проекте')}</label>
    <button type="button" disabled={!entry || !materialId || !file || !rights || busy} onClick={() => void submit()}
      className="border border-neutral-500 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40">
      {busy ? tr('Загрузка…') : tr('Применить текстуру')}
    </button>
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
    {message && <p role="status" className="text-xs text-green-700 dark:text-green-300">{message}</p>}
  </section>
}
