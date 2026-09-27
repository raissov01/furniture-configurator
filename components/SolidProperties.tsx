'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Field, NumberInput } from '@/components/ui'
import type { SolidNode } from '@/src/core/tree'
import { useConfigurator } from '@/store/configurator'
import { MoneyInput } from './MoneyInput'
import { SpecialPartProperties } from './SpecialPartProperties'

/** Decorative solids have scene properties only; they do not produce cut panels. */
export function SolidProperties({ node }: { node: SolidNode }) {
  const [name, setName] = useState(node.name)
  const [error, setError] = useState<string | null>(null)
  const [manufacturer, setManufacturer] = useState(node.solid.modelSource?.manufacturer ?? '')
  const [article, setArticle] = useState(node.solid.modelSource?.article ?? '')
  const [pageUrl, setPageUrl] = useState(node.solid.modelSource?.kind === 'manufacturer-page' ? node.solid.modelSource.pageUrl : '')
  useEffect(() => setName(node.name), [node.id, node.name])
  useEffect(() => {
    setManufacturer(node.solid.modelSource?.manufacturer ?? '')
    setArticle(node.solid.modelSource?.article ?? '')
    setPageUrl(node.solid.modelSource?.kind === 'manufacturer-page' ? node.solid.modelSource.pageUrl : '')
  }, [node.id, node.solid.modelSource])
  const renameNode = useConfigurator((state) => state.renameNode)
  const editSolid = useConfigurator((state) => state.editSolid)
  const setSolidPosition = useConfigurator((state) => state.setSolidPosition)
  const run = (edit: () => void) => {
    try { edit(); setError(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <section data-testid="solid-properties" className="space-y-3 text-xs">
    {error && <p role="alert" className="border border-red-500 p-2 text-red-700">{error}</p>}
    <Field label={tr('Название')}><input data-properties-name value={name}
      className="w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
      onChange={(event) => setName(event.target.value)} onBlur={() => {
        if (name !== node.name) run(() => renameNode(node.id, name))
      }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} /></Field>
    {node.solid.fabrication ? <SpecialPartProperties node={node} onError={setError} /> : node.solid.importedModel
      ? <p className="tabular-nums text-neutral-500">{node.solid.size.y} (H) × {node.solid.size.x} (W) × {node.solid.size.z} (D) мм</p>
      : <div className="grid grid-cols-3 gap-2" data-testid="solid-dimensions">
      {([['y', 'H'], ['x', 'W'], ['z', 'D']] as const).map(([axis, label]) =>
        <Field key={axis} label={`${label}, мм`}><NumberInput value={node.solid.size[axis]} min={1}
          onChange={(value) => run(() => editSolid(node.id, { size: { ...node.solid.size, [axis]: value } }))} /></Field>)}
    </div>}
    <div className="grid grid-cols-3 gap-2" data-testid="solid-position">
      {(['x', 'y', 'z'] as const).map((axis) => <Field key={axis} label={`${axis.toUpperCase()}, мм`}>
        <NumberInput value={node.transform.pos[axis]}
          onChange={(value) => run(() => setSolidPosition(node.id, { ...node.transform.pos, [axis]: value }))} />
      </Field>)}
    </div>
    <Field label={tr('Цвет')}><input type="color" aria-label={tr('Цвет')}
      className="h-8 w-full border border-neutral-300 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900"
      value={/^#[0-9a-fA-F]{6}$/.test(node.solid.color ?? '') ? node.solid.color : '#a3a3a3'}
      onChange={(event) => run(() => editSolid(node.id, { color: event.target.value }))} /></Field>
    {!node.solid.fabrication && <Field label={tr('Цена декора, ₸')}><MoneyInput label={tr('Цена декора, ₸')}
      value={node.solid.manualPriceTiyn} onChange={(minor) => run(() => editSolid(node.id, { manualPriceTiyn: minor }))} /></Field>}
    <div className="space-y-2 border border-neutral-300 p-2 dark:border-neutral-700">
      <p className="font-medium">{tr('Внешний источник модели (не проверен)')}</p>
      <p className="text-neutral-500">{tr('Ссылка сохраняется без файла модели. Лицензия для SaaS не подтверждена; цех загружает файл самостоятельно.')}</p>
      <Field label={tr('Производитель')}><input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}
        className="w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900" /></Field>
      <Field label={tr('Артикул')}><input value={article} onChange={(event) => setArticle(event.target.value)}
        className="w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900" /></Field>
      <Field label={tr('Внешняя ссылка (HTTPS)')}><input type="url" value={pageUrl} onChange={(event) => setPageUrl(event.target.value)}
        className="w-full border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900" /></Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="border border-neutral-400 px-2 py-1 dark:border-neutral-700" onClick={() => run(() => editSolid(node.id, {
          modelSource: { kind: 'manufacturer-page', manufacturer, article, pageUrl, licenseStatus: 'unverified' },
        }))}>{tr('Сохранить источник')}</button>
        {node.solid.modelSource && <button type="button" className="border border-neutral-400 px-2 py-1 dark:border-neutral-700"
          onClick={() => run(() => editSolid(node.id, { modelSource: undefined }))}>{tr('Убрать источник')}</button>}
      </div>
      {node.solid.modelSource?.kind === 'manufacturer-page' && <a href={node.solid.modelSource.pageUrl} target="_blank" rel="noopener noreferrer"
        className="inline-block underline">{tr('Открыть внешнюю ссылку')}</a>}
      {node.solid.modelSource?.kind === 'licensed-model' && <p>{tr('Лицензированная модель')}: {node.solid.modelSource.article}</p>}
    </div>
    {!node.solid.fabrication && <p className="text-neutral-500">{tr('Декоративный блок не входит в деталировку.')}</p>}
  </section>
}
