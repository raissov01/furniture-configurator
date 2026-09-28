'use client'

import * as React from 'react'
import { t as tr, tf } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import { createLibraryItem, findNode, mergeLibraryCatalog, replaceLibraryMaterial, walkTree } from '@/src/core/index'
import type { LibraryItem, SceneNode } from '@/src/core/index'
import { exportLibraryJson, importLibraryJson, readLocalLibrary, writeLocalLibrary } from '@/lib/libraryLocal'
import { importUploadSummary, LIBRARY_AUTH_CHANGED_EVENT, libraryUploadOutcome } from '@/lib/librarySyncUi'
import { LATHE_PROFILES } from '@/src/core/specialParts'

const inputStyle = 'min-w-0 border border-neutral-700 bg-[var(--p100-dialog-content)] px-1.5 py-1 text-xs text-neutral-100'
const buttonStyle = 'border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-[var(--p100-tool-hover)] disabled:opacity-40'

/** JSON өлшемдерінен жасалған нобай; бөгде өндірушінің суреті қолданылмайды. */
function ItemPreview({ item }: { item: LibraryItem }) {
  const width = Math.max(1, item.meta.sizeHint.x)
  const height = Math.max(1, item.meta.sizeHint.y)
  const scale = Math.min(58 / width, 36 / height)
  const w = Math.max(3, Math.round(width * scale))
  const h = Math.max(3, Math.round(height * scale))
  const x = Math.round((80 - w) / 2)
  const y = Math.round((48 - h) / 2)
  return <svg className="h-12 w-full border border-neutral-800 bg-[var(--p100-dialog)]" viewBox="0 0 80 48" role="img" aria-label={tr('Предпросмотр элемента')}>
    <rect x={x} y={y} width={w} height={h} fill="#404040" stroke="#a3a3a3" strokeWidth="1" />
    {item.node.kind === 'cabinet' || item.node.kind === 'group' ? <>
      <line x1={x + Math.round(w / 2)} y1={y} x2={x + Math.round(w / 2)} y2={y + h} stroke="#737373" />
      <line x1={x} y1={y + Math.round(h / 2)} x2={x + w} y2={y + Math.round(h / 2)} stroke="#737373" />
    </> : null}
    {item.node.kind === 'solid' ? <path d={`M${x},${y} l5,-3 h${w} l-5,3 M${x + w},${y} l5,-3 v${h} l-5,3`} fill="none" stroke="#737373" /> : null}
  </svg>
}

export function PersonalLibraryPanel() {
  const root = useConfigurator((state) => state.root)
  const activeId = useConfigurator((state) => state.activeId)
  const catalog = useConfigurator((state) => state.catalog)
  const projectSettings = useConfigurator((state) => state.projectSettings)
  const shopSettings = useConfigurator((state) => state.shop.settings)
  const placeLibraryItem = useConfigurator((state) => state.placeLibraryItem)
  const addSpecialPart = useConfigurator((state) => state.addSpecialPart)
  const editSolid = useConfigurator((state) => state.editSolid)
  const [local, setLocal] = React.useState<LibraryItem[]>([])
  const [remote, setRemote] = React.useState<LibraryItem[]>([])
  const [nodeId, setNodeId] = React.useState(activeId)
  const [category, setCategory] = React.useState(tr('Элементы'))
  const [categoryFilter, setCategoryFilter] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [oldMaterialId, setOldMaterialId] = React.useState('')
  const [newMaterialId, setNewMaterialId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [userId, setUserId] = React.useState<string | null | undefined>(undefined)
  const [authEpoch, setAuthEpoch] = React.useState(0)
  const [guestCount, setGuestCount] = React.useState(0)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const nodes = React.useMemo(() => {
    const result: SceneNode[] = []
    walkTree(root, (node) => { if (node.id !== root.id) result.push(node) })
    return result
  }, [root])
  const items = React.useMemo(() => {
    const ids = new Set(local.map((item) => item.id))
    return [...local, ...remote.filter((item) => !ids.has(item.id))]
  }, [local, remote])
  const categories = React.useMemo(() => [...new Set(items.map((item) => item.category))].sort(), [items])
  const shown = React.useMemo(() => items.filter((item) =>
    (!categoryFilter || item.category === categoryFilter)
    && `${item.name} ${item.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
  [items, categoryFilter, search])

  React.useEffect(() => {
    const refresh = () => setAuthEpoch((value) => value + 1)
    window.addEventListener(LIBRARY_AUTH_CHANGED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener(LIBRARY_AUTH_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh) }
  }, [])
  React.useEffect(() => {
    let active = true
    setUserId(undefined); setLocal([]); setRemote([]); setError(null); setMessage(null)
    void (async () => {
      try {
        const response = await fetch('/api/me', { cache: 'no-store' })
        if (!response.ok && response.status !== 503) throw new Error(tr('Библиотека аккаунта не загрузилась'))
        const body = response.ok ? await response.json() as { account?: { userId?: string } | null } : { account: null }
        const nextUserId = body.account?.userId ?? null
        if (!active) return
        setUserId(nextUserId)
        setLocal(readLocalLibrary(window.localStorage, nextUserId))
        if (nextUserId === null) return
        setGuestCount(readLocalLibrary(window.localStorage).length)
        const libraryResponse = await fetch('/api/library', { cache: 'no-store' })
        if (!active) return
        if (!libraryResponse.ok) throw new Error(tr('Библиотека аккаунта не загрузилась'))
        const library = await libraryResponse.json() as { items: LibraryItem[] }
        if (active) setRemote(library.items)
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : tr('Библиотека не прочиталась')) }
    })()
    return () => { active = false }
  }, [authEpoch])

  const persist = (next: LibraryItem[]) => {
    if (userId === undefined) throw new Error(tr('Библиотека аккаунта не загрузилась'))
    writeLocalLibrary(window.localStorage, next, userId)
    setLocal(next)
  }
  const upload = async (item: LibraryItem) => {
    if (userId === null) return libraryUploadOutcome(503, null)
    const response = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }) })
    const body = response.ok ? null : await response.json() as { error?: string }
    const outcome = libraryUploadOutcome(response.status, body?.error ?? null)
    if (outcome.savedToAccount) setRemote((current) => [...current.filter((entry) => entry.id !== item.id), item])
    return outcome
  }
  const save = async () => {
    try {
      const node = findNode(root, nodeId)
      if (!node || node.id === root.id) throw new Error(tr('Выберите элемент проекта'))
      const item = createLibraryItem(node, catalog, category.trim() || tr('Элементы'),
        new Date().toISOString(), crypto.randomUUID(), projectSettings ?? shopSettings)
      persist([...local, item])
      setError(null); setMessage(null)
      try {
        const outcome = await upload(item)
        setMessage(tr(outcome.message)); setError(outcome.error)
      } catch (cause) {
        setMessage(tr('Сохранено только на этом устройстве'))
        setError(cause instanceof Error ? cause.message : tr('Не удалось сохранить в аккаунте'))
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось сохранить элемент')) }
  }
  const place = (item: LibraryItem) => {
    try { mergeLibraryCatalog(catalog, item); placeLibraryItem(item); setError(null); setMessage(tr('Элемент добавлен в проект')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось добавить элемент')) }
  }
  const remove = (item: LibraryItem) => {
    try {
      persist(local.filter((entry) => entry.id !== item.id))
      setError(null)
      if (!remote.some((entry) => entry.id === item.id)) return
      void fetch('/api/library', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }) }).then((response) => {
        if (response.status === 401 || response.status === 503) throw new Error(tr('Копия в аккаунте не удалена'))
        if (!response.ok && response.status !== 404) throw new Error(tr('Не удалось удалить из аккаунта'))
        setRemote((current) => current.filter((entry) => entry.id !== item.id))
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : tr('Не удалось удалить из аккаунта')))
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось удалить элемент')) }
  }
  const exportJson = () => {
    try {
      const blob = new Blob([exportLibraryJson(items)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'furniture-library.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось экспортировать JSON')) }
  }
  const syncImported = async (next: LibraryItem[]) => {
    let saved = 0
    for (const item of next) {
      try {
        const outcome = await upload(item)
        if (outcome.savedToAccount) saved += 1
        else if (outcome.error) { setError(outcome.error); break }
      } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось сохранить в аккаунте')); break }
    }
    setMessage(userId === null ? tr('Библиотека импортирована только на этом устройстве')
      : tf(importUploadSummary(saved, next.length), { saved, total: next.length }))
  }
  const importFile = async (file: File) => {
    try {
      const next = importLibraryJson(await file.text(), items)
      persist(next)
      setError(null); setMessage(null)
      await syncImported(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось импортировать JSON')) }
  }
  const replaceAll = async () => {
    try {
      const material = catalog.materials.find((entry) => entry.id === newMaterialId)
      if (!material || !oldMaterialId) throw new Error(tr('Выберите материалы'))
      const next = items.map((item) => {
        const source = { materials: [...catalog.materials.filter((entry) => !item.materials.some((own) => own.id === entry.id)), ...item.materials],
          edgeBands: [...catalog.edgeBands.filter((entry) => !item.edgeBands.some((own) => own.id === entry.id)), ...item.edgeBands] }
        return item.materials.some((entry) => entry.id === oldMaterialId)
          ? replaceLibraryMaterial(item, oldMaterialId, material, source) : item
      })
      persist(next)
      setError(null); setMessage(tr('Материал заменён в библиотеке'))
      await syncImported(next)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось заменить материал')) }
  }

  return <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto bg-[var(--p100-dialog-content)] p-2 text-neutral-100">
    <section className="border border-neutral-700 p-2 text-xs" data-testid="special-part-library">
      <div className="mb-1 font-semibold">{tr('Токарная деталь')} · {tr('Гнутая деталь')}</div>
      <div className="flex flex-wrap gap-1">
        {LATHE_PROFILES.map((preset) => <button key={preset.id} type="button" className={buttonStyle}
          onClick={() => {
            try {
              const id = addSpecialPart('lathe')
              const node = findNode(useConfigurator.getState().root, id)
              if (node?.kind !== 'solid' || node.solid.fabrication?.kind !== 'lathe') throw new Error(tr('Токарная деталь не создана'))
              editSolid(id, { fabrication: { ...node.solid.fabrication, profile: structuredClone(preset.profile) } })
              setError(null)
            } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
          }}>{tr(preset.name)}</button>)}
        <button type="button" className={buttonStyle} onClick={() => {
          try { addSpecialPart('bent'); setError(null) }
          catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
        }}>{tr('Гнутая деталь')}</button>
      </div>
    </section>
    <label className="text-xs">{tr('Элемент проекта')}
      <select className={`mt-1 w-full ${inputStyle}`} value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
        {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
      </select>
    </label>
    <div className="flex gap-1">
      <input className={`flex-1 ${inputStyle}`} aria-label={tr('Категория')} value={category} onChange={(event) => setCategory(event.target.value)} />
      <button type="button" className={buttonStyle} onClick={() => void save()} disabled={!nodes.length || userId === undefined}>{tr('Сохранить в библиотеку')}</button>
    </div>
    {userId && guestCount > 0 && <button type="button" className={buttonStyle} onClick={() => {
      try {
        const guest = readLocalLibrary(window.localStorage)
        const next = importLibraryJson(exportLibraryJson(guest), items)
        persist(next)
        writeLocalLibrary(window.localStorage, [])
        setGuestCount(0)
        setError(null)
        void syncImported(next)
      } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось импортировать JSON')) }
    }}>{tr('Перенести гостевую библиотеку в аккаунт')}</button>}
    <div className="flex gap-1">
      <select className={`w-1/2 ${inputStyle}`} aria-label={tr('Фильтр категории')} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
        <option value="">{tr('Все категории')}</option>
        {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
      </select>
      <input className={`w-1/2 ${inputStyle}`} aria-label={tr('Поиск в библиотеке')} placeholder={tr('Поиск')} value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    <div className="flex gap-1">
      <button type="button" className={buttonStyle} onClick={exportJson}>{tr('Экспорт JSON')}</button>
      <button type="button" className={buttonStyle} onClick={() => fileRef.current?.click()}>{tr('Импорт JSON')}</button>
      <input ref={fileRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => {
        const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''
      }} />
    </div>
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {shown.map((item) => <div key={item.id} className="border border-neutral-700 p-1.5 text-xs">
        <ItemPreview item={item} />
        <div className="truncate" title={item.name}>{item.name}</div>
        <div className="truncate text-neutral-500">{item.category} · {item.meta.sizeHint.y} (H) × {item.meta.sizeHint.x} (W) × {item.meta.sizeHint.z} (D) мм</div>
        <div className="mt-1 flex min-w-0 flex-col gap-1 xl:flex-row">
          <button type="button" className={`${buttonStyle} min-w-0`} onClick={() => place(item)}>{tr('Поставить')}</button>
          <button type="button" className={`${buttonStyle} min-w-0`} onClick={() => remove(item)}>{tr('Удалить')}</button>
        </div>
      </div>)}
    </div>
    {shown.length === 0 && <p className="text-xs text-neutral-500">{tr('В библиотеке нет элементов')}</p>}
    {items.length > 0 && <section className="border-t border-neutral-700 pt-2 text-xs">
      <div className="mb-1">{tr('Замена материалов в библиотеке')}</div>
      <div className="flex gap-1">
        <select className={`w-1/2 ${inputStyle}`} aria-label={tr('Старый материал')} value={oldMaterialId} onChange={(event) => setOldMaterialId(event.target.value)}>
          <option value="">{tr('Старый материал')}</option>
          {[...new Map(items.flatMap((item) => item.materials).map((material) => [material.id, material])).values()].map((material) =>
            <option key={material.id} value={material.id}>{material.name}</option>)}
        </select>
        <select className={`w-1/2 ${inputStyle}`} aria-label={tr('Новый материал')} value={newMaterialId} onChange={(event) => setNewMaterialId(event.target.value)}>
          <option value="">{tr('Новый материал')}</option>
          {catalog.materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
        </select>
      </div>
      <button type="button" className={`mt-1 ${buttonStyle}`} disabled={!oldMaterialId || !newMaterialId || oldMaterialId === newMaterialId} onClick={() => void replaceAll()}>{tr('Заменить во всей библиотеке')}</button>
    </section>}
    {error && <p role="alert" className="border border-[var(--p100-invalid)] p-1 text-xs text-[var(--p100-invalid)]">{error}</p>}
    {message && <p role="status" className="text-xs text-neutral-400">{message}</p>}
  </div>
}
