'use client'

import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { parseAssetImport } from '@/lib/assetImportUi'
import type { BoardNode, SolidNode } from '@/src/core/tree'
import type { Material } from '@/src/core/types'

type Props = {
  materials: Material[]
  onImport?: ((node: BoardNode | SolidNode) => void) | undefined
}

export function AssetImportPanel({ materials, onImport }: Props) {
  const [file, setFile] = React.useState<{ name: string; bytes: Uint8Array; id: string } | null>(null)
  const [materialId, setMaterialId] = React.useState(materials[0]?.id ?? '')
  const [objScale, setObjScale] = React.useState('')
  const [readError, setReadError] = React.useState('')
  const [saved, setSaved] = React.useState(false)
  const effectiveMaterialId = materials.some((material) => material.id === materialId) ? materialId : materials[0]?.id ?? ''
  const parsed = React.useMemo(() => {
    if (!file) return null
    try {
      return { value: parseAssetImport(file.name, file.bytes, file.id,
        { materialId: effectiveMaterialId, mmPerUnit: objScale.trim() ? Number(objScale) : undefined }) }
    } catch (cause) { return { error: cause instanceof Error ? cause.message : String(cause) } }
  }, [file, effectiveMaterialId, objScale])
  const node = parsed?.value?.node
  const isObj = file?.name.toLowerCase().endsWith('.obj') ?? false
  const isDxf = file?.name.toLowerCase().endsWith('.dxf') ?? false

  return <section className="space-y-3 p-2 text-[11px] text-neutral-200">
    <p className="text-neutral-500">{tr('DXF: прямоугольная доска. OBJ/GLB: декоративный объект без раскроя.')}</p>
    <label className="block">{tr('Файл детали или модели')}
      <input type="file" accept=".dxf,.obj,.glb" className="mt-1 block w-full border border-neutral-700 bg-neutral-900 p-1"
        onChange={async (event) => {
          const selected = event.currentTarget.files?.[0]
          setSaved(false); setFile(null); setReadError('')
          if (!selected) return
          if (selected.size > 20_000_000) { setReadError(tr('Файл слишком большой (максимум 20 МБ)')); return }
          try { setFile({ name: selected.name, bytes: new Uint8Array(await selected.arrayBuffer()), id: `import-${crypto.randomUUID()}` }) }
          catch (cause) { setReadError(cause instanceof Error ? cause.message : String(cause)) }
        }} />
    </label>
    {isDxf && <label className="block">{tr('Материал детали')}
      <select value={effectiveMaterialId} onChange={(event) => { setMaterialId(event.target.value); setSaved(false) }}
        className="mt-1 block w-full border border-neutral-700 bg-neutral-900 p-1.5">
        {materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.thickness} мм</option>)}
      </select>
    </label>}
    {isObj && <label className="block">{tr('Миллиметров в одной единице OBJ')}
      <input type="number" min="0.001" step="any" value={objScale} onChange={(event) => { setObjScale(event.target.value); setSaved(false) }}
        placeholder={tr('Укажите масштаб из исходного файла')}
        className="mt-1 block w-full border border-neutral-700 bg-neutral-900 p-1.5" />
    </label>}
    {(readError || parsed?.error) && <p role="alert" className="border border-red-800 p-2 text-red-300">{readError || parsed?.error}</p>}
    {node && <div className="space-y-1 border border-neutral-700 p-2">
      <p>{node.name}</p>
      {node.kind === 'board'
        ? <p>{tr('Деталь')}: {node.board.length} мм × {node.board.width} мм</p>
        : <p>{tr('Габарит H × W × D')}: {node.solid.size.y} (H) × {node.solid.size.x} (W) × {node.solid.size.z} (D) мм</p>}
      {node.kind === 'solid' && <p className="text-neutral-500">{tr('В проекте сохранится только габаритный блок; сетка модели не сохраняется.')}</p>}
      {parsed?.value?.materialNames.length ? <p className="text-neutral-500">{tr('Материалы модели')}: {parsed.value.materialNames.join(', ')}</p> : null}
    </div>}
    <button type="button" disabled={!node || !onImport || saved}
      className="w-full border border-neutral-600 bg-neutral-100 p-1.5 text-neutral-900 disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-600"
      onClick={() => {
        if (!node || !onImport) return
        try { onImport(node); setSaved(true); setReadError('') }
        catch (cause) { setReadError(cause instanceof Error ? cause.message : String(cause)) }
      }}>{saved ? tr('Импортировано') : tr('Добавить в проект')}</button>
  </section>
}
