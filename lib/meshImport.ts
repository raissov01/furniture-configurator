import { Box3, Group, LoadingManager } from 'three'
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { ConfigValidationError } from '@/src/core/errors'
import { importObjSolid } from '@/src/core/import/solid'
import { MAX_IMPORTED_MODEL_BYTES, validateImportedModel, validateTdsBytes } from '@/src/core/import/tds'
import type { ImportedModelSpec } from '@/src/core/import/tds'
import type { SolidImportOptions } from '@/src/core/import/solid'
import type { SolidNode } from '@/src/core/tree'

export function bytesToBase64(bytes: Uint8Array): string {
  let text = ''
  for (let at = 0; at < bytes.length; at += 8192) {
    text += String.fromCharCode(...bytes.subarray(at, at + 8192))
  }
  return btoa(text)
}
export function base64ToBytes(value: string): Uint8Array {
  const decoded = atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

/** TDSLoader-дің материал/UV/mesh талдауын қолданамыз; өзек тек шекті тексереді. */
export function parseTdsSolid(bytes: Uint8Array, options: SolidImportOptions,
  textures: Record<string, string> = {}): { node: SolidNode; materialNames: string[] } {
  validateTdsBytes(bytes)
  if (!options.id?.trim() || !options.name?.trim()) {
    throw new ConfigValidationError('solid.name', 'id мен атау бос болмауы керек', 'бос емес мәтін')
  }
  const scale = options.mmPerUnit
  if (!scale || !Number.isFinite(scale) || scale <= 0) {
    throw new ConfigValidationError('solid.mmPerUnit', 'бірлік масштабы қажет', 'оң мм/бірлік')
  }
  const importedModel: ImportedModelSpec = { format: '3ds', dataBase64: bytesToBase64(bytes), mmPerUnit: scale,
    ...(Object.keys(textures).length ? { textures } : {}) }
  validateImportedModel(importedModel)
  const manager = textureManager(textures)
  const loader = new TDSLoader(manager)
  let group: Group
  try { group = loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '') }
  catch (cause) { throw new ConfigValidationError('3ds.data', `3DS оқылмады: ${cause instanceof Error ? cause.message : String(cause)}`, 'жарамды 3DS mesh') }
  if (!group.children.length) throw new ConfigValidationError('3ds.mesh', 'mesh табылмады', 'кемі бір үшбұрыш')
  const bounds = new Box3().setFromObject(group)
  if (bounds.isEmpty()) throw new ConfigValidationError('3ds.mesh', 'mesh шекарасы жоқ', 'оң үш ось')
  const min = bounds.min.toArray().map((value) => Math.round(value * scale))
  const max = bounds.max.toArray().map((value) => Math.round(value * scale))
  const size = max.map((value, index) => value - min[index]!)
  if ([...min, ...max, ...size].some((value) => !Number.isSafeInteger(value)) || size.some((value) => value <= 0)) {
    throw new ConfigValidationError('3ds.size', 'габарит бүтін мм-де барлық осьте оң болуы керек', 'x/y/z > 0 бүтін мм')
  }
  return { node: { kind: 'solid', id: options.id, name: options.name,
    transform: { pos: { x: min[0]!, y: min[1]!, z: min[2]! }, rot: { x: 0, y: 0, z: 0 } },
    solid: { size: { x: size[0]!, y: size[1]!, z: size[2]! }, importedModel } },
    materialNames: loader.materials.map((material) => material.name).filter(Boolean) }
}

export function parseObjSolidForScene(text: string, options: SolidImportOptions): SolidNode {
  const bytes = new TextEncoder().encode(text)
  if (bytes.byteLength > MAX_IMPORTED_MODEL_BYTES) throw new ConfigValidationError('obj.size', 'OBJ тым үлкен', `≤ ${MAX_IMPORTED_MODEL_BYTES} bytes`)
  const result = importObjSolid(text, options)
  const mesh = new OBJLoader().parse(text)
  if (!mesh.children.length) throw new ConfigValidationError('obj.faces', 'рендерге жарайтын face жоқ', 'кемі бір f жолы')
  const importedModel: ImportedModelSpec = { format: 'obj', dataBase64: bytesToBase64(bytes), mmPerUnit: options.mmPerUnit! }
  validateImportedModel(importedModel)
  return { ...result.node, solid: { ...result.node.solid, importedModel } }
}

function textureManager(textures: Record<string, string>): LoadingManager {
  const manager = new LoadingManager()
  const byName = new Map(Object.entries(textures).map(([name, uri]) => [name.toLowerCase(), uri]))
  manager.setURLModifier((url) => {
    const name = url.split(/[\\/]/).at(-1)?.toLowerCase() ?? ''
    // Жүктелмеген сыртқы файлға желілік сұрау жібермейміз; тек осы жобамен
    // бірге берілген текстура қолданылады.
    return byName.get(name) ?? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9zqV3GQAAAABJRU5ErkJggg=='
  })
  return manager
}

/** Scene тек сақталған деректі оқиды; импорттау кезінде өлшем SolidSpec.size-ке бекітілген. */
export function importedMesh(spec: ImportedModelSpec): Group {
  validateImportedModel(spec)
  const bytes = base64ToBytes(spec.dataBase64)
  const manager = textureManager(spec.textures ?? {})
  const object = spec.format === '3ds'
    ? new TDSLoader(manager).parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
    : new OBJLoader(manager).parse(new TextDecoder().decode(bytes))
  const bounds = new Box3().setFromObject(object)
  const wrapper = new Group()
  wrapper.add(object)
  wrapper.scale.setScalar(spec.mmPerUnit)
  wrapper.position.set(-bounds.min.x * spec.mmPerUnit, -bounds.min.y * spec.mmPerUnit, -bounds.min.z * spec.mmPerUnit)
  return wrapper
}
