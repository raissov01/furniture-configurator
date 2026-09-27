'use client'

/**
 * DXF импорт панелі — докинг жүйесінде (`components/dock/`).
 *
 * Цехтағы нақты сценарий: сәулетшіден/клиенттен бөлменің 2D жоспары DXF
 * болып келеді. Мұнда файл таңдалады, қабат (`LAYER`) таңдалады, алдын ала
 * қабырғалар мен өлшемдер көрсетіледі, «Импорттау» нәтижені сыртқа
 * (`onImport`) шығарады.
 *
 * ⚠ Бұл панель дербес: бөлме стейтіне (`store/configurator.ts`) ӨЗІ
 * ЖАЗБАЙДЫ — сол стор бөлек агенттердің жұмысында, ортақ файлды тартыну
 * қауіпті. Нақты бөлмені жаңарту `onImport`-ты шақырушының ісі (немесе
 * кейін қосылатын стор экшені). Есепте бұл егжей-тегжейлі жазылған.
 *
 * Дизайн: градиент/blur/эмоджі ЖОҚ — тұтас түс + 1px жиек, қара тақырып
 * (docking жүйесінің өзі осылай: `border-neutral-800 bg-neutral-950`).
 */
import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import type { DxfImportResult } from '@/src/core/import/dxf'
import { ConfigValidationError } from '@/src/core/errors'
import { canConfirmDxfImport } from '@/lib/dxfImportAction'
import { canApplyRoomImport, parseRoomImport } from '@/lib/roomImportUi'
import type { RoomImportPreview } from '@/lib/roomImportUi'
import type { Material } from '@/src/core/types'
import type { BoardNode, SolidNode } from '@/src/core/tree'
import { AssetImportPanel } from './AssetImportPanel'

const ALL_LAYERS = '__all__'

function WallsPreview({ result }: { result: DxfImportResult }) {
  if (!result.bounds || result.walls.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center border border-neutral-800 text-[11px] text-neutral-600">
        {tr('Нет стен для предпросмотра')}
      </div>
    )
  }
  const pad = 20
  const xs = result.walls.flatMap((w) => [w.start.x, w.end.x])
  const zs = result.walls.flatMap((w) => [w.start.z, w.end.z])
  const minX = Math.min(...xs)
  const minZ = Math.min(...zs)
  const w = Math.max(1, result.bounds.width)
  const h = Math.max(1, result.bounds.depth)
  const scale = Math.min((320 - pad * 2) / w, (240 - pad * 2) / h)
  const toSvg = (x: number, z: number) => [pad + (x - minX) * scale, pad + (z - minZ) * scale] as const

  return (
    <svg viewBox="0 0 320 240" className="h-40 w-full border border-neutral-800 bg-neutral-950">
      {result.walls.map((wall, i) => {
        const [x1, y1] = toSvg(wall.start.x, wall.start.z)
        const [x2, y2] = toSvg(wall.end.x, wall.end.z)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#e5e5e5"
            strokeWidth={2}
            strokeLinecap="square"
          />
        )
      })}
    </svg>
  )
}

function RoomImportPanel({ onImport }: { onImport?: ((result: DxfImportResult) => void) | undefined } = {}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rawText, setRawText] = React.useState<string | null>(null)
  const [selectedLayer, setSelectedLayer] = React.useState<string>(ALL_LAYERS)
  const [selectedShape, setSelectedShape] = React.useState('')
  const [mmPerUnit, setMmPerUnit] = React.useState('')
  const [preview, setPreview] = React.useState<RoomImportPreview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [imported, setImported] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const runParse = React.useCallback((name: string, text: string, layer: string, shape: string, scale: string) => {
    try {
      const numericScale = scale.trim() === '' ? undefined : Number(scale)
      if (numericScale !== undefined && (!Number.isFinite(numericScale) || numericScale <= 0)) {
        throw new Error(`${tr('Масштаб, мм/ед.')}: ${tr('Введите число больше нуля')}`)
      }
      const result = parseRoomImport(name, text, {
        ...(layer === ALL_LAYERS ? {} : { layer }),
        ...(shape ? { elementId: shape } : {}),
        ...(numericScale === undefined ? {} : { mmPerUnit: numericScale }),
      })
      setPreview(result)
      setError(null)
    } catch (err) {
      setPreview(null)
      setError(err instanceof ConfigValidationError ? err.message : `${tr('Не удалось прочитать план')}: ${String(err)}`)
    }
  }, [])

  const handleFile = React.useCallback((file: File) => {
    setImported(false)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setRawText(text)
      setSelectedLayer(ALL_LAYERS)
      setSelectedShape('')
      setMmPerUnit('')
      runParse(file.name, text, ALL_LAYERS, '', '')
    }
    reader.onerror = () => {
      setPreview(null)
      setError(tr('Не удалось прочитать файл'))
    }
    reader.readAsText(file)
  }, [runParse])

  const onLayerChange = (layer: string) => {
    setSelectedLayer(layer)
    setImported(false)
    if (rawText !== null && fileName) runParse(fileName, rawText, layer, selectedShape, mmPerUnit)
  }

  const onShapeChange = (shape: string) => {
    setSelectedShape(shape)
    setImported(false)
    if (rawText !== null && fileName) runParse(fileName, rawText, selectedLayer, shape, mmPerUnit)
  }

  const onScaleChange = (scale: string) => {
    setMmPerUnit(scale)
    setImported(false)
    if (rawText !== null && fileName) runParse(fileName, rawText, selectedLayer, selectedShape, scale)
  }

  const doImport = () => {
    if (!preview || !canApplyRoomImport(preview.result) || !canConfirmDxfImport(preview.result.walls.length, Boolean(onImport), imported)) return
    try {
      onImport?.(preview.result)
      setError(null)
      setImported(true)
    } catch (cause) {
      setImported(false)
      setError(tr(cause instanceof Error ? cause.message : String(cause)))
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-2 text-neutral-100">
      <p className="text-[10px] leading-relaxed text-neutral-500">
        {tr('Прямоугольный DXF/SVG-план обновит ширину (W) и глубину (D) комнаты; мебель не добавится.')}
      </p>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dxf,.svg,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-left text-[11px] text-neutral-300 hover:border-neutral-600 hover:text-neutral-100"
        >
          {fileName ?? tr('Выбрать DXF/SVG-файл…')}
        </button>
      </div>

      {error ? (
        <div className="border border-red-900 bg-red-950/40 p-2 text-[11px] text-red-300">{error}</div>
      ) : null}

      {preview ? (
        <>
          {preview.format === 'dxf' ? <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-neutral-500">{tr('Слой')}</span>
            <select
              value={selectedLayer}
              onChange={(e) => onLayerChange(e.target.value)}
              className="w-full border border-neutral-800 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 outline-none focus:border-neutral-500"
            >
              <option value={ALL_LAYERS}>{tr('Все слои')} ({preview.result.layers.length})</option>
              {preview.result.layers.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label> : <>
            <label className="block text-[11px] text-neutral-400">
              {tr('Контур SVG')}
              <select value={selectedShape} onChange={(event) => onShapeChange(event.target.value)}
                className="mt-1 w-full border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200">
                <option value="">{tr('Самый большой контур')}</option>
                {preview.shapes.filter((shape) => shape.label.startsWith('#') && !shape.label.includes('/')).map((shape) => (
                  <option key={shape.label} value={shape.label.slice(1)}>{shape.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-neutral-400">
              {tr('Масштаб, мм/ед.')}
              <input type="number" min="0.001" step="any" value={mmPerUnit}
                onChange={(event) => onScaleChange(event.target.value)}
                placeholder={tr('Из размеров SVG')}
                className="mt-1 w-full border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-200" />
            </label>
          </>}

          <WallsPreview result={preview.result} />

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-400">
            <span>{tr('Стен')}</span>
            <span className="tabular-nums text-neutral-200">{preview.result.walls.length}</span>
            <span>{tr('Габарит')}</span>
            <span className="tabular-nums text-neutral-200">
              {preview.result.bounds ? `${preview.result.bounds.width} (W) × ${preview.result.bounds.depth} (D) мм` : '—'}
            </span>
            <span>{tr('Единицы источника')}</span>
            <span className="tabular-nums text-neutral-200">
              {preview.result.sourceUnits}{preview.result.unitsConverted ? ` → ${tr('мм (пересчитано)')}` : ' (мм)'}
            </span>
          </div>

          {preview.result.skipped.length > 0 ? (
            <div className="border border-amber-900 bg-amber-950/30 p-2 text-[11px] text-amber-300">
              {tr('Не поддерживается, пропущено')}:{' '}
              {preview.result.skipped.map((s) => `${s.type} ×${s.count}`).join(', ')}
            </div>
          ) : null}

          {!canApplyRoomImport(preview.result) && <div role="status"
            className="border border-amber-800 p-2 text-[11px] text-amber-300">
            {tr('Контур можно просмотреть, но текущая модель комнаты принимает только прямоугольный пол.')}
          </div>}

          <button
            type="button"
            onClick={doImport}
            disabled={!canApplyRoomImport(preview.result) || !canConfirmDxfImport(preview.result.walls.length, Boolean(onImport), imported)}
            title={!onImport ? tr('Только предпросмотр: откройте импорт в проекте') : undefined}
            className="mt-auto w-full border border-neutral-700 bg-neutral-100 px-2 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-900 disabled:text-neutral-600"
          >
            {imported ? tr('Импортировано') : tr('Импортировать')}
          </button>
        </>
      ) : null}
    </div>
  )
}

export function ImportPanel({ onImport, onImportAsset, materials = [] }: {
  onImport?: ((result: DxfImportResult) => void) | undefined
  onImportAsset?: ((node: BoardNode | SolidNode) => void) | undefined
  materials?: Material[]
} = {}) {
  const [mode, setMode] = React.useState<'room' | 'asset'>('room')
  return <div className="flex h-full flex-col text-neutral-100">
    <div className="flex border-b border-neutral-800 text-[11px]">
      <button type="button" onClick={() => setMode('room')}
        className={`flex-1 border-r border-neutral-800 p-2 ${mode === 'room' ? 'bg-neutral-800' : 'bg-neutral-950'}`}>
        {tr('План комнаты')}
      </button>
      <button type="button" onClick={() => setMode('asset')}
        className={`flex-1 p-2 ${mode === 'asset' ? 'bg-neutral-800' : 'bg-neutral-950'}`}>
        {tr('Деталь / модель')}
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      {mode === 'room' ? <RoomImportPanel onImport={onImport} /> : <AssetImportPanel materials={materials} onImport={onImportAsset} />}
    </div>
  </div>
}
