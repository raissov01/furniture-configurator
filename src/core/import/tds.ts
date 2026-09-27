import { ConfigValidationError } from '../errors'

/** Жоба JSON-ына кіретін mesh үшін шек; үлкен активтерді сыртқы каталогқа қою керек. */
export const MAX_IMPORTED_MODEL_BYTES = 2 * 1024 * 1024
export const MAX_IMPORTED_TEXTURE_BYTES = 4 * 1024 * 1024
/** LocalStorage/жоба JSON-ының шамамен 4 МБ base64 шегі үшін жалпы бинарь көлемі. */
export const MAX_IMPORTED_ASSET_BYTES = 3 * 1024 * 1024

export type ImportedModelSpec = { format: '3ds' | 'obj'; dataBase64: string;
  mmPerUnit: number; textures?: Record<string, string> | undefined }

export function validateTdsBytes(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_IMPORTED_MODEL_BYTES) {
    throw new ConfigValidationError('3ds.size', 'файл size шегінен асты', `≤ ${MAX_IMPORTED_MODEL_BYTES} bytes`)
  }
  if (bytes.byteLength < 12) {
    throw new ConfigValidationError('3ds.header', '3ds файлы тым қысқа', '3DS main chunk')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint16(0, true) !== 0x4d4d) {
    throw new ConfigValidationError('3ds.header', '3ds тақырыбы жарамсыз', '0x4D4D')
  }
  if (view.getUint32(2, true) !== bytes.byteLength) {
    throw new ConfigValidationError('3ds.length', '3ds length мәні нақты өлшеммен сәйкес емес', `${bytes.byteLength}`)
  }
}

export function validateImportedModel(spec: ImportedModelSpec): void {
  if (!Number.isFinite(spec.mmPerUnit) || spec.mmPerUnit <= 0) {
    throw new ConfigValidationError('import.mmPerUnit', 'бірлік масштабы жарамсыз', 'оң мм/бірлік')
  }
  if (!spec.dataBase64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(spec.dataBase64) ||
      spec.dataBase64.length > Math.ceil(MAX_IMPORTED_MODEL_BYTES * 4 / 3) + 4) {
    throw new ConfigValidationError('import.dataBase64', 'mesh дерегі жарамсыз не үлкен', `≤ ${MAX_IMPORTED_MODEL_BYTES} bytes`)
  }
  if (spec.format === '3ds') {
    validateTdsBytes(Uint8Array.from(atob(spec.dataBase64), (character) => character.charCodeAt(0)))
  }
  const textures = Object.entries(spec.textures ?? {})
  const total = textures.reduce((sum, [name, value]) => {
    if (!/^[^/\\]+\.(?:png|jpe?g|webp)$/i.test(name) ||
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) {
      throw new ConfigValidationError('import.textures', 'текстура аты не мазмұны жарамсыз', 'PNG/JPEG/WebP data URI')
    }
    return sum + value.length
  }, 0)
  if (total > Math.ceil(MAX_IMPORTED_TEXTURE_BYTES * 4 / 3) + textures.length * 30) {
    throw new ConfigValidationError('import.textures', 'текстуралар тым үлкен', `≤ ${MAX_IMPORTED_TEXTURE_BYTES} bytes`)
  }
  if (spec.dataBase64.length + total > Math.ceil(MAX_IMPORTED_ASSET_BYTES * 4 / 3) + textures.length * 30) {
    throw new ConfigValidationError('import.size', 'модель мен текстуралардың жалпы көлемі үлкен', `≤ ${MAX_IMPORTED_ASSET_BYTES} bytes`)
  }
}
