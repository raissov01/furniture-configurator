import { importDxfRoomPlan } from '@/src/core/import/dxf'
import type { DxfImportResult } from '@/src/core/import/dxf'
import { importSvgRoomPlan } from '@/src/core/import/svgRoom'
import { dxfRoomSize } from '@/lib/dxfRoomSize'

export type RoomImportSelection = { layer?: string; elementId?: string; mmPerUnit?: number }
export type RoomImportPreview = {
  format: 'dxf' | 'svg'
  result: DxfImportResult
  shapes: { label: string; areaMm2: number }[]
}

/** File extension selects the parser; an SVG cannot be interpreted as a partial DXF. */
export function parseRoomImport(fileName: string, text: string, selection: RoomImportSelection = {}): RoomImportPreview {
  const extension = fileName.toLowerCase().split('.').pop()
  if (extension === 'dxf') {
    return { format: 'dxf', result: importDxfRoomPlan(text, selection.layer ? { layer: selection.layer } : {}), shapes: [] }
  }
  if (extension === 'svg') {
    const result = importSvgRoomPlan(text, {
      ...(selection.elementId ? { elementId: selection.elementId } : {}),
      ...(selection.mmPerUnit !== undefined ? { mmPerUnit: selection.mmPerUnit } : {}),
    })
    return { format: 'svg', result, shapes: result.shapes }
  }
  throw new Error(`Файл түрі жарамсыз: ${fileName}. DXF немесе SVG таңдаңыз.`)
}

/** Current Room geometry is rectangular; preview any outline, apply only a true rectangle. */
export function canApplyRoomImport(result: DxfImportResult): boolean {
  try { dxfRoomSize(result); return true }
  catch { return false }
}
