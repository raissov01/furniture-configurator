import { ConfigValidationError } from '@/src/core/errors'
import { importDxfBoard } from '@/src/core/import/dxfBoard'
import { importGlbSolid, importObjSolid } from '@/src/core/import/solid'
import type { BoardNode, SolidNode } from '@/src/core/tree'

export type AssetImportOptions = { materialId?: string; mmPerUnit?: number | undefined }
export type AssetImportResult = { node: BoardNode | SolidNode; materialNames: string[] }

function decode(bytes: Uint8Array, field: string): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch (cause) {
    throw new ConfigValidationError(field, `UTF-8 файл оқылмады: ${cause instanceof Error ? cause.message : String(cause)}`, 'UTF-8 мәтін')
  }
}

export function parseAssetImport(
  fileName: string, bytes: Uint8Array, id: string, options: AssetImportOptions,
): AssetImportResult {
  const extension = fileName.toLowerCase().split('.').at(-1)
  const name = fileName.replace(/\.(dxf|obj|glb)$/iu, '').trim()
  if (extension === 'dxf') {
    if (!options.materialId) throw new ConfigValidationError('materialId', 'материал таңдалмаған', 'жоба материалы')
    return { node: importDxfBoard(decode(bytes, 'dxf.file'), { id, name, materialId: options.materialId }), materialNames: [] }
  }
  if (extension === 'obj') {
    return importObjSolid(decode(bytes, 'obj.file'), { id, name,
      ...(options.mmPerUnit === undefined ? {} : { mmPerUnit: options.mmPerUnit }) })
  }
  if (extension === 'glb') return importGlbSolid(bytes, { id, name })
  throw new ConfigValidationError('fileName', 'пішім қолдаусыз', '.dxf, .obj немесе .glb')
}
