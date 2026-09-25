'use client'

import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { useConfigurator } from '@/store/configurator'
import { createLibraryItem, findNode, mergeLibraryCatalog, replaceLibraryMaterial, walkTree } from '@/src/core/index'
import type { LibraryItem, SceneNode } from '@/src/core/index'
import { exportLibraryJson, importLibraryJson, readLocalLibrary, writeLocalLibrary } from '@/lib/libraryLocal'

const inputStyle = 'min-w-0 border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-100'
const buttonStyle = 'border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40'

/** JSON өлшемдерінен жасалған нобай; бөгде өндірушінің суреті қолданылмайды. */
function ItemPreview({ item }: { item: LibraryItem }) {
  const width = Math.max(1, item.meta.sizeHint.x)
  const height = Math.max(1, item.meta.sizeHint.y)
  const scale = Math.min(58 / width, 36 / height)
  const w = Math.max(3, Math.round(width * scale))
  const h = Math.max(3, Math.round(height * scale))
  const x = Math.round((80 - w) / 2)
  const y = Math.round((48 - h) / 2)
  return <svg className="h-12 w-full border border-neutral-800 bg-neutral-900" viewBox="0 0 80 48" role="img" aria-label={tr('Предпросмотр элемента')}>
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
    try { setLocal(readLocalLibrary(window.localStorage)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('Библиотека не прочиталась')) }
    void fetch('/api/library').then(async (response) => {
      if (response.status === 401 || response.status === 503) { setMessage(tr('Доступна только локальная библиотека')); return }
      if (!response.ok) throw new Error(tr('Библиотека аккаунта не загрузилась'))
      const body = await response.json() as { items: LibraryItem[] }
      setRemote(body.items)
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : tr('Библиотека аккаунта не загрузилась')))
  }, [])

  const persist = (next: LibraryItem[]) => {
    writeLocalLibrary(window.localStorage, next)
    setLocal(next)
  }
  const upload = async (item: LibraryItem) => {
    const response = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }) })
    if (response.status === 401 || response.status === 503) {
      setMessage(tr('Сохранено только на этом устройстве'))
      return
    }
    if (!response.ok) throw new Error(tr('Не удалось сохранить в аккаунте'))
    setRemote((current) => [...current.filter((entry) => entry.id !== item.id), item])
  }
  const save = () => {
    try {
      const node = findNode(root, nodeId)
      if (!node || node.id === root.id) throw new Error(tr('Выберите элемент проекта'))
      const item = createLibraryItem(node, catalog, category.trim() || tr('Элементы'),
        new Date().toISOString(), crypto.randomUUID(), projectSettings ?? shopSettings)
      persist([...local, item])
      setError(null); setMessage(tr('Элемент сохранён'))
      void upload(item).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : tr('Не удалось сохранить в аккаунте')))
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
  const importFile = async (file: File) => {
    try {
      const next = importLibraryJson(await file.text(), items)
      persist(next)
      setError(null); setMessage(tr('Библиотека импортирована'))
      for (const item of next) await upload(item)
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
      for (const item of next) await upload(item)
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Не удалось заменить материал')) }
  }

  return <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto bg-neutral-950 p-2 text-neutral-100">
    <label className="text-xs">{tr('Элемент проекта')}
      <select className={`mt-1 w-full ${inputStyle}`} value={nodeId} onChange={(event) => setNodeId(event.target.value)}>
        {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
      </select>
    </label>
    <div className="flex gap-1">
      <input className={`flex-1 ${inputStyle}`} aria-label={tr('Категория')} value={category} onChange={(event) => setCategory(event.target.value)} />
      <button type="button" className={buttonStyle} onClick={save} disabled={!nodes.length}>{tr('Сохранить в библиотеку')}</button>
    </div>
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
    <div className="grid grid-cols-2 gap-1">
      {shown.map((item) => <div key={item.id} className="border border-neutral-700 p-1.5 text-xs">
        <ItemPreview item={item} />
        <div className="truncate" title={item.name}>{item.name}</div>
        <div className="truncate text-neutral-500">{item.category} · {item.meta.sizeHint.y} (H) × {item.meta.sizeHint.x} (W) × {item.meta.sizeHint.z} (D) мм</div>
        <div className="mt-1 flex gap-1">
          <button type="button" className={buttonStyle} onClick={() => place(item)}>{tr('Поставить')}</button>
          <button type="button" className={buttonStyle} onClick={() => remove(item)}>{tr('Удалить')}</button>
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
    {error && <p role="alert" className="border border-red-700 p-1 text-xs text-red-300">{error}</p>}
    {message && <p role="status" className="text-xs text-neutral-400">{message}</p>}
  </div>
}
