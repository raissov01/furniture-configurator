'use client'

import { useEffect, useMemo, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { DEFAULT_BASIS_COLUMNS, previewBasisTable } from '@/src/core/ownCatalogImport'
import type { BasisColumnMap, BasisPreview } from '@/src/core/ownCatalogImport'
import { parsePriceFile } from '@/src/core/priceImport'
import type { PriceTable } from '@/src/core/priceImport'
import { parsePro100Textures } from '@/src/core/pro100Textures'
import type { Pro100TexturePreview } from '@/src/core/pro100Textures'
import type { Material, EdgeBand } from '@/src/core/types'

type Format = 'basis-xlsx' | 'pro100-ini'
type SavedImport = { id: string; format: Format; data: unknown; byteSize: number; createdAt: number }
type ResponseError = { error?: string }

const FILE_LIMIT = 10_000_000
const SHOP_QUOTA = 30_000_000
const mappingFields = Object.keys(DEFAULT_BASIS_COLUMNS) as Array<keyof BasisColumnMap>

function errorMessage(cause: unknown): string { return cause instanceof Error ? cause.message : String(cause) }
function isBasisPreview(data: unknown): data is BasisPreview {
  if (!data || typeof data !== 'object') return false
  const value = data as Partial<BasisPreview>
  return Array.isArray(value.materials) && Array.isArray(value.edgeBands) && Array.isArray(value.errors)
}
function decodeIni(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('windows-1251').decode(bytes) }
}

/** Үлкен Базис экспортын түгел профильге көшірмей, нақты позицияны таңдау. */
export function SavedBasisImport({ preview, onApplyMaterials }: {
  preview: BasisPreview; onApplyMaterials: (materials: Material[], edgeBands: EdgeBand[]) => void
}) {
  const [materialSearch, setMaterialSearch] = useState('')
  const [bandSearch, setBandSearch] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState('')
  const [selectedBand, setSelectedBand] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const materials = preview.materials.filter((item) => `${item.name} ${item.id}`.toLocaleLowerCase().includes(materialSearch.toLocaleLowerCase()))
  const bands = preview.edgeBands.filter((item) => `${item.name} ${item.id}`.toLocaleLowerCase().includes(bandSearch.toLocaleLowerCase()))
  const apply = (material?: Material, band?: EdgeBand) => {
    setError(null); setNotice(null)
    try {
      onApplyMaterials(material ? [material] : [], band ? [band] : [])
      setNotice(tr('Позиция добавлена в профиль цеха'))
    } catch (cause) { setError(errorMessage(cause)) }
  }
  return <div className="mt-2 grid gap-2 sm:grid-cols-2">
    {preview.materials.length > 0 && <div className="space-y-1">
      <label className="block">{tr('Найти материал в импорте')}
        <input value={materialSearch} onChange={(event) => { setMaterialSearch(event.target.value); setSelectedMaterial('') }}
          className="mt-1 block w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900" />
      </label>
      <select aria-label={tr('Материал импорта')} value={selectedMaterial} onChange={(event) => setSelectedMaterial(event.target.value)}
        className="w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
        <option value="">{tr('Выберите материал')}</option>
        {materials.slice(0, 30).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p className="text-neutral-500 dark:text-neutral-400">{materials.length} {tr('записей')}; {tr('показаны первые 30')}</p>
      <button type="button" disabled={!selectedMaterial} onClick={() => {
        const item = preview.materials.find((entry) => entry.id === selectedMaterial)
        if (item) apply(item)
      }} className="border border-neutral-500 px-2 py-1 disabled:opacity-40">{tr('Добавить выбранный материал')}</button>
    </div>}
    {preview.edgeBands.length > 0 && <div className="space-y-1">
      <label className="block">{tr('Найти кромку в импорте')}
        <input value={bandSearch} onChange={(event) => { setBandSearch(event.target.value); setSelectedBand('') }}
          className="mt-1 block w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900" />
      </label>
      <select aria-label={tr('Кромка импорта')} value={selectedBand} onChange={(event) => setSelectedBand(event.target.value)}
        className="w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
        <option value="">{tr('Выберите кромку')}</option>
        {bands.slice(0, 30).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <p className="text-neutral-500 dark:text-neutral-400">{bands.length} {tr('записей')}; {tr('показаны первые 30')}</p>
      <button type="button" disabled={!selectedBand} onClick={() => {
        const item = preview.edgeBands.find((entry) => entry.id === selectedBand)
        if (item) apply(undefined, item)
      }} className="border border-neutral-500 px-2 py-1 disabled:opacity-40">{tr('Добавить выбранную кромку')}</button>
    </div>}
    {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </div>
}

export function OwnCatalogImportPanel({ onApplyMaterials }: {
  onApplyMaterials: (materials: Material[], edgeBands: EdgeBand[]) => void
}) {
  const [format, setFormat] = useState<Format>('basis-xlsx')
  const [file, setFile] = useState<File | null>(null)
  const [table, setTable] = useState<PriceTable | null>(null)
  const [iniPreview, setIniPreview] = useState<Pro100TexturePreview | null>(null)
  const [map, setMap] = useState<BasisColumnMap>(DEFAULT_BASIS_COLUMNS)
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [imports, setImports] = useState<SavedImport[]>([])

  const basisResult = useMemo(() => {
    if (!table) return { preview: null, error: null }
    try { return { preview: previewBasisTable(table, map), error: null } }
    catch (cause) { return { preview: null, error: errorMessage(cause) } }
  }, [table, map])
  const preview = format === 'basis-xlsx' ? basisResult.preview : iniPreview
  const previewErrors = preview?.errors ?? []
  const validCount = preview ? 'materials' in preview ? preview.materials.length + preview.edgeBands.length : preview.textures.length : 0

  const refresh = async () => {
    const response = await fetch('/api/own-catalog')
    const payload = await response.json() as { imports?: SavedImport[] } & ResponseError
    if (!response.ok) throw new Error(payload.error ?? tr('Не удалось открыть каталог цеха'))
    setImports(Array.isArray(payload.imports) ? payload.imports : [])
  }
  useEffect(() => { refresh().catch((cause: unknown) => setError(errorMessage(cause))) }, [])

  const selectFile = async (selected: File) => {
    setFile(null); setTable(null); setIniPreview(null); setError(null); setNotice(null); setRights(false)
    if (selected.size > FILE_LIMIT) { setError(tr('Файл превышает лимит 10 МБ')); return }
    try {
      const bytes = new Uint8Array(await selected.arrayBuffer())
      if (format === 'basis-xlsx') {
        const parsed = parsePriceFile(bytes, 'xlsx', { maxBytes: FILE_LIMIT, maxRows: 50_000 })
        setMap(Object.fromEntries(mappingFields.map((field) => [field,
          parsed.headers.includes(DEFAULT_BASIS_COLUMNS[field]) ? DEFAULT_BASIS_COLUMNS[field] : ''])) as BasisColumnMap)
        setTable(parsed)
      } else setIniPreview(parsePro100Textures(decodeIni(bytes)))
      setFile(selected)
    } catch (cause) { setError(errorMessage(cause)) }
  }

  const save = async () => {
    if (!file || !rights || validCount === 0 || busy || basisResult.error && format === 'basis-xlsx') return
    setBusy(true); setError(null); setNotice(null)
    try {
      const headers: Record<string, string> = { 'x-rights-confirmed': 'true' }
      // Request headers accept ASCII; Russian Excel column names need percent encoding.
      if (format === 'basis-xlsx') headers['x-column-map'] = encodeURIComponent(JSON.stringify(map))
      const response = await fetch(`/api/own-catalog?format=${format}`, { method: 'POST', headers, body: file })
      const payload = await response.json() as ResponseError
      if (!response.ok) throw new Error(payload.error ?? tr('Не удалось сохранить импорт'))
      await refresh()
      setNotice(tr('Импорт сохранён в аккаунте цеха'))
      setRights(false)
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/own-catalog?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const payload = await response.json() as ResponseError
      if (!response.ok) throw new Error(payload.error ?? tr('Не удалось удалить импорт'))
      await refresh()
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return <section className="space-y-3 border border-neutral-300 p-2 text-xs dark:border-neutral-700" aria-label={tr('Библиотека моего цеха')}>
    <h3 className="font-semibold">{tr('Библиотека моего цеха')}</h3>
    <p className="text-neutral-500 dark:text-neutral-400">{tr('Импорт виден только вашему цеху. Исходный файл не сохраняется; формат и ошибки можно проверить до загрузки.')}</p>
    <div className="flex gap-3">
      <label><input type="radio" name="own-catalog-format" checked={format === 'basis-xlsx'} onChange={() => {
        setFormat('basis-xlsx'); setFile(null); setTable(null); setIniPreview(null); setError(null)
      }} /> {tr('Базис Excel')}</label>
      <label><input type="radio" name="own-catalog-format" checked={format === 'pro100-ini'} onChange={() => {
        setFormat('pro100-ini'); setFile(null); setTable(null); setIniPreview(null); setError(null)
      }} /> PRO100 textures.ini</label>
    </div>
    <label className="block">{tr('Файл для импорта')}
      <input type="file" accept={format === 'basis-xlsx' ? '.xlsx' : '.ini,text/plain'} onChange={(event) => {
        const chosen = event.target.files?.[0]
        if (chosen) void selectFile(chosen)
        event.target.value = ''
      }} className="mt-1 block w-full border border-neutral-300 p-1 dark:border-neutral-700" />
    </label>
    {table && <div className="grid gap-2 sm:grid-cols-2" aria-label={tr('Соответствие колонок')}>
      {mappingFields.map((field) => <label key={field}>{tr(DEFAULT_BASIS_COLUMNS[field])}
        <select value={map[field]} onChange={(event) => setMap((current) => ({ ...current, [field]: event.target.value }))}
          className="mt-1 block w-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">{tr('Выберите колонку')}</option>
          {table.headers.map((header, index) => <option key={`${header}-${index}`} value={header}>{header}</option>)}
        </select>
      </label>)}
    </div>}
    {basisResult.error && format === 'basis-xlsx' && <p role="alert" className="text-red-700 dark:text-red-300">{basisResult.error}</p>}
    {preview && <div className="space-y-1 border border-neutral-300 p-2 dark:border-neutral-700">
      <p>{tr('Предпросмотр')}: {validCount} {tr('записей')}; {previewErrors.length} {tr('ошибок')}</p>
      {'materials' in preview && <ul className="max-h-24 overflow-auto">{preview.materials.slice(0, 5).map((item) =>
        <li key={item.id}>{item.name} · {item.thickness} {tr('мм')}</li>)}</ul>}
      {'textures' in preview && <ul className="max-h-24 overflow-auto">{preview.textures.slice(0, 5).map((item) =>
        <li key={item.name}>{item.name} · {item.mapSizeMm.y} (H) × {item.mapSizeMm.x} (W) {tr('мм')}</li>)}</ul>}
      {previewErrors.length > 0 && <ul className="max-h-24 overflow-auto text-red-700 dark:text-red-300">{previewErrors.slice(0, 10).map((item, index) =>
        <li key={index}>{tr('Строка')} {'rowNumber' in item ? item.rowNumber : item.lineNumber}: {item.reason}</li>)}</ul>}
    </div>}
    <label className="flex items-start gap-2"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
      <span>{tr('Подтверждаю, что имею право использовать и загружать этот контент для своего цеха')}</span></label>
    <button type="button" disabled={!file || !rights || validCount === 0 || busy || Boolean(basisResult.error && format === 'basis-xlsx')}
      onClick={() => void save()} className="border border-neutral-500 px-3 py-1 disabled:opacity-40">{tr('Сохранить импорт')}</button>
    {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <h4 className="font-semibold">{tr('Сохранённые импорты')}</h4>
    <p>{tr('Квота цеха')}: {(imports.reduce((sum, item) => sum + item.byteSize, 0) / 1_000_000).toFixed(1)} / {SHOP_QUOTA / 1_000_000} {tr('МБ')}</p>
    <ul className="space-y-1">{imports.map((item) => {
      const data = item.data
      return <li key={item.id} className="border border-neutral-300 p-2 dark:border-neutral-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{item.format === 'basis-xlsx' ? tr('Базис Excel') : 'PRO100 textures.ini'} · {new Date(item.createdAt).toLocaleDateString()}</span>
      <span className="flex gap-1">
        <button type="button" disabled={busy} onClick={() => void remove(item.id)} className="border border-neutral-500 px-2 py-1 disabled:opacity-40">{tr('Удалить')}</button>
      </span>
      </div>
      {item.format === 'basis-xlsx' && isBasisPreview(data) && <SavedBasisImport preview={data} onApplyMaterials={onApplyMaterials} />}
    </li>})}</ul>
    {imports.some((item) => item.format === 'pro100-ini') && <p className="text-neutral-500 dark:text-neutral-400">{tr('textures.ini сохраняет только параметры. Изображения в этом импорте не загружаются.')}</p>}
  </section>
}
