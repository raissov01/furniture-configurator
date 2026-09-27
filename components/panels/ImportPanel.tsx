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
 * Дизайн: градиент/blur/эмоджі жоқ — PRO100 ашық токендері мен 1px жиек.
 */
import * as React from 'react'
import { t as tr } from '@/lib/i18n'
import { importDxfRoomPlan } from '@/src/core/import/dxf'
import type { DxfImportResult } from '@/src/core/import/dxf'
import { ConfigValidationError } from '@/src/core/errors'
import { canConfirmDxfImport } from '@/lib/dxfImportAction'

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
    <svg viewBox="0 0 320 240" className="h-40 w-full border border-neutral-800 bg-[var(--p100-dialog-content)]">
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
            stroke="var(--p100-text)"
            strokeWidth={2}
            strokeLinecap="square"
          />
        )
      })}
    </svg>
  )
}

export function ImportPanel({ onImport }: { onImport?: (result: DxfImportResult) => void } = {}) {
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [rawText, setRawText] = React.useState<string | null>(null)
  const [selectedLayer, setSelectedLayer] = React.useState<string>(ALL_LAYERS)
  const [preview, setPreview] = React.useState<DxfImportResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [imported, setImported] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const runParse = React.useCallback((text: string, layer: string) => {
    try {
      const result = importDxfRoomPlan(text, layer === ALL_LAYERS ? {} : { layer })
      setPreview(result)
      setError(null)
    } catch (err) {
      setPreview(null)
      setError(err instanceof ConfigValidationError ? err.message : `${tr('Не удалось прочитать DXF')}: ${String(err)}`)
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
      runParse(text, ALL_LAYERS)
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
    if (rawText !== null) runParse(rawText, layer)
  }

  const doImport = () => {
    if (!preview || !canConfirmDxfImport(preview.walls.length, Boolean(onImport), imported)) return
    try {
      onImport?.(preview)
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
        {tr('Прямоугольный DXF-план обновит ширину (W) и глубину (D) комнаты; мебель не добавится.')}
      </p>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dxf"
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
          className="w-full border border-neutral-800 bg-[var(--p100-dialog)] px-2 py-1.5 text-left text-[11px] text-neutral-300 hover:border-neutral-600 hover:text-neutral-100"
        >
          {fileName ?? tr('Выбрать DXF-файл…')}
        </button>
      </div>

      {error ? (
        <div className="border border-[var(--p100-invalid)] bg-[var(--p100-dialog-content)] p-2 text-[11px] text-[var(--p100-invalid)]">{error}</div>
      ) : null}

      {preview ? (
        <>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-neutral-500">{tr('Слой')}</span>
            <select
              value={selectedLayer}
              onChange={(e) => onLayerChange(e.target.value)}
              className="w-full border border-neutral-800 bg-[var(--p100-dialog)] px-2 py-1 text-[11px] text-neutral-200 outline-none focus:border-neutral-500"
            >
              <option value={ALL_LAYERS}>{tr('Все слои')} ({preview.layers.length})</option>
              {preview.layers.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>

          <WallsPreview result={preview} />

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-400">
            <span>{tr('Стен')}</span>
            <span className="tabular-nums text-neutral-200">{preview.walls.length}</span>
            <span>{tr('Габарит')}</span>
            <span className="tabular-nums text-neutral-200">
              {preview.bounds ? `${preview.bounds.width} × ${preview.bounds.depth} мм` : '—'}
            </span>
            <span>{tr('Единицы источника')}</span>
            <span className="tabular-nums text-neutral-200">
              {preview.sourceUnits}{preview.unitsConverted ? ` → ${tr('мм (пересчитано)')}` : ' (мм)'}
            </span>
          </div>

          {preview.skipped.length > 0 ? (
            <div className="border border-[var(--p100-warning)] bg-[var(--p100-dialog-content)] p-2 text-[11px] text-[var(--p100-warning)]">
              {tr('Не поддерживается, пропущено')}:{' '}
              {preview.skipped.map((s) => `${s.type} ×${s.count}`).join(', ')}
            </div>
          ) : null}

          <button
            type="button"
            onClick={doImport}
            disabled={!canConfirmDxfImport(preview.walls.length, Boolean(onImport), imported)}
            title={!onImport ? tr('Только предпросмотр: откройте импорт в проекте') : undefined}
            className="mt-auto w-full border border-neutral-700 bg-neutral-100 px-2 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-white disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-[var(--p100-dialog)] disabled:text-neutral-600"
          >
            {imported ? tr('Импортировано') : tr('Импортировать')}
          </button>
        </>
      ) : null}
    </div>
  )
}
