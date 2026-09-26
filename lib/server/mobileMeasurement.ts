import { createHash } from 'node:crypto'
import { canonicalJson } from '@/src/core/approval'
import { MeasurementSurveySchema, type MeasurementSurvey } from '@/src/core/measure'
import { validateAction, type Revision, type SyncAction } from '@/src/core/sync/types'
import { db } from './db'

export class MobileMeasurementError extends Error {
  constructor(public readonly status: 400 | 409 | 413 | 422, message: string) { super(message) }
}

type MeasurementRow = { json: string; revision_version: number; revision_updated_at: number }
type ActionRow = { entity_id: string; request_json: string; revision_version: number; revision_updated_at: number }
type PhotoRow = { mime: string; bytes: Uint8Array; sha256: string }

const PHOTO_MAX_BYTES = 8_000_000 // Техникалық жүктеу шегі: бір телефон фотосы сервер жадын толтырмауы үшін.
const photoId = (value: string): string => {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new MobileMeasurementError(400, 'photoRef: 1–128 қауіпсіз таңба қажет')
  return value
}

function validNow(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new MobileMeasurementError(400, 'time: бүтін Unix миллисекунды қажет')
}

/** Same ID and bytes are safe to upload again after a dropped response. */
export function saveMeasurementPhoto(shopId: string, id: string, mime: string, bytes: Uint8Array, now: number): 'applied' | 'duplicate' {
  validNow(now)
  photoId(id)
  if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new MobileMeasurementError(413, 'photo: 8 МБ-тан кіші бос емес сурет қажет')
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mime)) {
    throw new MobileMeasurementError(400, 'photo: JPEG, PNG, WebP не HEIC қажет')
  }
  const hash = createHash('sha256').update(bytes).digest('hex')
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const previous = database.prepare('SELECT mime, sha256 FROM mobile_measurement_photos WHERE shop_id = ? AND id = ?')
      .get(shopId, id) as Pick<PhotoRow, 'mime' | 'sha256'> | undefined
    if (previous) {
      if (previous.mime !== mime || previous.sha256 !== hash) {
        throw new MobileMeasurementError(409, 'photo ID: басқа суретке қолданылған')
      }
      database.exec('COMMIT')
      return 'duplicate'
    }
    // MIME ғана жеткіліксіз; танылатын сурет тақырыбын тексереміз.
    const jpeg = mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const png = mime === 'image/png' && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
    const ascii = (start: number, word: string) => [...word].every((char, i) => bytes[start + i] === char.charCodeAt(0))
    const webp = mime === 'image/webp' && ascii(0, 'RIFF') && ascii(8, 'WEBP')
    const heic = (mime === 'image/heic' || mime === 'image/heif') && ascii(4, 'ftyp')
    if (!jpeg && !png && !webp && !heic) throw new MobileMeasurementError(400, 'photo: файл тақырыбы түріне сәйкес емес')
    database.prepare(`INSERT INTO mobile_measurement_photos (shop_id, id, mime, bytes, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(shopId, id, mime, bytes, hash, now)
    database.exec('COMMIT')
    return 'applied'
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}

export function readMeasurementPhoto(shopId: string, id: string): { mime: string; bytes: Uint8Array } | null {
  photoId(id)
  const row = db().prepare('SELECT mime, bytes FROM mobile_measurement_photos WHERE shop_id = ? AND id = ?')
    .get(shopId, id) as Pick<PhotoRow, 'mime' | 'bytes'> | undefined
  return row ?? null
}

export function readMeasurement(shopId: string, id: string): { survey: MeasurementSurvey; revision: Revision } | null {
  const row = db().prepare('SELECT json, revision_version, revision_updated_at FROM mobile_measurements WHERE shop_id = ? AND id = ?')
    .get(shopId, id) as MeasurementRow | undefined
  return row ? {
    survey: MeasurementSurveySchema.parse(JSON.parse(row.json) as unknown),
    revision: { version: row.revision_version, updatedAt: row.revision_updated_at },
  } : null
}

type SyncReply =
  | { kind: 'applied' | 'duplicate'; revision: Revision }
  | { kind: 'conflict'; revision: Revision; serverValue: MeasurementSurvey }

/** Atomic revision check and idempotent write; caller authenticates the shop and role. */
export function applyMeasurementSync(shopId: string, action: SyncAction, now: number): SyncReply {
  validNow(now)
  validateAction(action)
  if (action.kind !== 'measurement.upsert') throw new MobileMeasurementError(400, 'kind: measurement.upsert қажет')
  const survey = MeasurementSurveySchema.parse(action.payload)
  if (action.entityId !== survey.id) throw new MobileMeasurementError(400, 'entityId: өлшем ID-імен сәйкес болуы керек')
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const requestJson = canonicalJson(action)
    const previous = database.prepare(`SELECT entity_id, request_json, revision_version, revision_updated_at
      FROM mobile_measurement_actions WHERE shop_id = ? AND id = ?`).get(shopId, action.id) as ActionRow | undefined
    if (previous) {
      if (previous.entity_id !== action.entityId || previous.request_json !== requestJson) {
        throw new MobileMeasurementError(409, 'action ID: басқа өлшемге қолданылған')
      }
      database.exec('COMMIT')
      return { kind: 'duplicate', revision: { version: previous.revision_version, updatedAt: previous.revision_updated_at } }
    }

    const current = readMeasurement(shopId, action.entityId)
    if (current && (current.revision.version !== action.baseRevision.version || current.revision.updatedAt !== action.baseRevision.updatedAt)) {
      database.exec('COMMIT')
      return { kind: 'conflict', revision: current.revision, serverValue: current.survey }
    }
    if (!current && (action.baseRevision.version !== 0 || action.baseRevision.updatedAt !== 0)) {
      throw new MobileMeasurementError(409, 'baseRevision: жоқ өлшемнің нұсқасы 0 болуы керек')
    }
    const refs = new Set<string>()
    for (const wall of Object.values(survey.walls)) {
      for (const answer of Object.values(wall.obstacles)) {
        if (answer.photoRef?.trim()) refs.add(photoId(answer.photoRef))
      }
    }
    for (const ref of refs) {
      const found = database.prepare('SELECT 1 FROM mobile_measurement_photos WHERE shop_id = ? AND id = ?').get(shopId, ref)
      if (!found) throw new MobileMeasurementError(422, `photoRef: ${ref} фотосы жүктелмеген`)
    }
    const revision: Revision = {
      version: (current?.revision.version ?? 0) + 1,
      updatedAt: Math.max(now, (current?.revision.updatedAt ?? -1) + 1),
    }
    if (current) {
      database.prepare(`UPDATE mobile_measurements SET json = ?, revision_version = ?, revision_updated_at = ?
        WHERE shop_id = ? AND id = ?`).run(JSON.stringify(survey), revision.version, revision.updatedAt, shopId, survey.id)
    } else {
      database.prepare(`INSERT INTO mobile_measurements
        (shop_id, id, json, revision_version, revision_updated_at) VALUES (?, ?, ?, ?, ?)`)
        .run(shopId, survey.id, JSON.stringify(survey), revision.version, revision.updatedAt)
    }
    database.prepare(`INSERT INTO mobile_measurement_actions
      (shop_id, id, entity_id, request_json, revision_version, revision_updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(shopId, action.id, action.entityId, requestJson, revision.version, revision.updatedAt)
    database.exec('COMMIT')
    return { kind: 'applied', revision }
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}
