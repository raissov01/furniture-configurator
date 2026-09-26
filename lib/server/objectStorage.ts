import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'

export type ObjectKind = 'photo' | 'render' | 'library' | 'shop-library' | 'export'
export type StoredObject = { bytes: Uint8Array; contentType: string }
export interface ObjectStorage {
  put(shopId: string, kind: ObjectKind, bytes: Uint8Array, contentType: string): Promise<string>
  get(shopId: string, key: string): Promise<StoredObject | null>
  delete(shopId: string, key: string): Promise<void>
}

const SHOP = /^[a-zA-Z0-9_-]{1,100}$/
const KEY = /^(photo|render|library|shop-library|export)\/[0-9a-f-]{36}$/
const MAX_BYTES = 25_000_000

function validate(shopId: string, key?: string): void {
  if (!SHOP.test(shopId) || (key !== undefined && !KEY.test(key))) throw new Error('Қойма кілті жарамсыз')
}

function validateUpload(bytes: Uint8Array, contentType: string): void {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Файл 25 МБ-тан аспауы керек')
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) throw new Error('MIME түрі жарамсыз')
}

export class DiskObjectStorage implements ObjectStorage {
  constructor(private readonly root: string) {}
  async put(shopId: string, kind: ObjectKind, bytes: Uint8Array, contentType: string): Promise<string> {
    validate(shopId)
    validateUpload(bytes, contentType)
    const key = `${kind}/${randomUUID()}`
    const path = join(this.root, shopId, key)
    await mkdir(join(this.root, shopId, kind), { recursive: true })
    await writeFile(`${path}.tmp`, bytes)
    await rename(`${path}.tmp`, path)
    await writeFile(`${path}.mime`, contentType)
    return key
  }
  async get(shopId: string, key: string): Promise<StoredObject | null> {
    validate(shopId, key)
    const path = join(this.root, shopId, key)
    try {
      const [bytes, contentType] = await Promise.all([readFile(path), readFile(`${path}.mime`, 'utf8')])
      return { bytes, contentType }
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT') return null
      throw cause
    }
  }
  async delete(shopId: string, key: string): Promise<void> {
    validate(shopId, key)
    const path = join(this.root, shopId, key)
    await Promise.all([rm(path, { force: true }), rm(`${path}.mime`, { force: true })])
  }
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client
  constructor(private readonly bucket: string, endpoint?: string) {
    this.client = new S3Client({
      region: process.env['S3_REGION'] ?? 'us-east-1',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    })
  }
  async put(shopId: string, kind: ObjectKind, bytes: Uint8Array, contentType: string): Promise<string> {
    validate(shopId)
    validateUpload(bytes, contentType)
    const key = `${kind}/${randomUUID()}`
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: `${shopId}/${key}`, Body: bytes, ContentType: contentType }))
    return key
  }
  async get(shopId: string, key: string): Promise<StoredObject | null> {
    validate(shopId, key)
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: `${shopId}/${key}` }))
      if (!result.Body) return null
      return { bytes: await result.Body.transformToByteArray(), contentType: result.ContentType ?? 'application/octet-stream' }
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'name' in cause && (cause.name === 'NoSuchKey' || cause.name === 'NotFound')) return null
      throw cause
    }
  }
  async delete(shopId: string, key: string): Promise<void> {
    validate(shopId, key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: `${shopId}/${key}` }))
  }
}

let singleton: ObjectStorage | undefined
export function objectStorage(): ObjectStorage {
  if (!singleton) singleton = process.env['S3_BUCKET']
    ? new S3ObjectStorage(process.env['S3_BUCKET'], process.env['S3_ENDPOINT'])
    : new DiskObjectStorage(join(process.env['DATA_DIR'] ?? join(process.cwd(), '.data'), 'objects'))
  return singleton
}
