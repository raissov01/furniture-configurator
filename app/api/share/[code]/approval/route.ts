/** Клиент келісімі: share-дің әр өзгерісі жеке, өзгермейтін снимок болады. */
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import { cloudOff } from '@/lib/server/cloud'
import { db } from '@/lib/server/db'
import { currentAccount } from '@/lib/server/session'
import { allowComment, allowShareMiss, isShareLimited, requestIp } from '@/lib/server/rateLimit'
import { can } from '@/lib/permissions'
import { approvalStampPdf, approveRevision, createApprovalRevision, parseProjectV4, projectFingerprint } from '@/src/core/index'
import { toPublicProject } from '@/src/core/publicProject'
import type { ApprovalRevision, ProjectFileV4 } from '@/src/core/index'

type Context = { params: Promise<{ code: string }> }
type ShareRow = { json: string; shop_id: string | null; created_at: number }
type Stored = { id: string; version: number; project_json: string; hash: string;
  price_minor: number; created_at: number; seal_json: string | null; otp_hash: string;
  attempts: number; preview_png: Uint8Array | null }
const codePattern = /^\d{6}$/
const startInput = z.strictObject({ previewPngBase64: z.string().max(1_500_000).optional() })
const confirmInput = z.strictObject({ confirmationCode: z.string().regex(codePattern) })

function error(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function shareRow(code: string): ShareRow | null {
  if (!codePattern.test(code)) return null
  return (db().prepare('SELECT json, shop_id, created_at FROM shares WHERE code = ? AND expires_at > ?')
    .get(code, Date.now()) as ShareRow | undefined) ?? null
}

/** Migration is idempotent; the route owns this small feature table. */
function approvalTable(): void {
  db().exec(`CREATE TABLE IF NOT EXISTS approval_revisions (
    id TEXT PRIMARY KEY, share_code TEXT NOT NULL, share_created_at INTEGER NOT NULL,
    shop_id TEXT NOT NULL, version INTEGER NOT NULL, project_json TEXT NOT NULL,
    hash TEXT NOT NULL, price_minor INTEGER NOT NULL, created_at INTEGER NOT NULL,
    seal_json TEXT, otp_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    preview_png BLOB, UNIQUE(share_code, share_created_at, version)
  )`)
}

function readVersion(code: string, shareCreatedAt: number, version?: number): Stored | null {
  approvalTable()
  const sql = `SELECT * FROM approval_revisions WHERE share_code = ? AND share_created_at = ?
    ${version === undefined ? 'ORDER BY version DESC LIMIT 1' : 'AND version = ?'}`
  return (db().prepare(sql).get(...(version === undefined ? [code, shareCreatedAt] : [code, shareCreatedAt, version])) as Stored | undefined) ?? null
}

function revision(row: Stored): ApprovalRevision<ProjectFileV4> {
  return {
    version: row.version, project: JSON.parse(row.project_json) as ProjectFileV4,
    hash: row.hash, priceMinor: row.price_minor, createdAt: row.created_at,
    seal: row.seal_json ? JSON.parse(row.seal_json) as ApprovalRevision<ProjectFileV4>['seal'] : null,
  }
}

function publicProject(json: string): ProjectFileV4 {
  return toPublicProject(parseProjectV4(JSON.parse(json) as unknown))
}

function codeHash(id: string, code: string): string {
  return createHash('sha256').update(`${id}\0${code}`).digest('hex')
}

async function previewPng(encoded: string | undefined): Promise<Uint8Array | null> {
  if (encoded === undefined) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('previewPngBase64')
  const png = new Uint8Array(Buffer.from(encoded, 'base64'))
  if (png.length > 1_000_000 || png.length < 24 ||
    !Buffer.from(png.slice(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('previewPngBase64')
  }
  // Толық декодтау: тек PNG сигнатурасы бар бүлінген файл кейін PDF-те 500 бермесін.
  await (await PDFDocument.create()).embedPng(png)
  return png
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const { code } = await params
    const account = await currentAccount()
    if (!account) return error('Нужен вход', 401)
    if (!can(account.role, 'editProject')) return error('Доступ запрещён', 403)
    const share = shareRow(code)
    if (!share) return error('Код не найден или истёк', 404)
    if (!share.shop_id || share.shop_id !== account.shopId) return error('Доступ запрещён', 403)
    const body = await request.text()
    if (body.length > 1_500_100) return error('Слишком большой запрос', 413)
    let raw: unknown
    try { raw = JSON.parse(body) as unknown } catch { return error('Некорректный JSON', 400) }
    const parsed = startInput.safeParse(raw)
    if (!parsed.success) return error('Неверные данные', 400)
    let project: ProjectFileV4
    try { project = publicProject(share.json) } catch { return error('Проект повреждён', 422) }
    const priceMinor = project.priceOverrides?.salePrice
    if (!Number.isSafeInteger(priceMinor) || priceMinor === undefined || priceMinor < 0) {
      return error('Для согласования нужна точная итоговая цена', 422)
    }
    let png: Uint8Array | null
    try { png = await previewPng(parsed.data.previewPngBase64) } catch { return error('Неверный PNG', 400) }
    const hash = await projectFingerprint(project)
    const latest = readVersion(code, share.created_at)
    if (latest?.hash === hash && latest.price_minor === priceMinor) return error('Эта версия уже ожидает или получила согласование', 409)
    const now = Date.now()
    const next = await createApprovalRevision(project, priceMinor, now, (latest?.version ?? 0) + 1)
    const id = randomUUID()
    const confirmationCode = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const database = db()
    database.exec('BEGIN IMMEDIATE')
    try {
      if (shareRow(code)?.json !== share.json || readVersion(code, share.created_at)?.version !== latest?.version) {
        database.exec('ROLLBACK')
        return error('Проект или версия изменились; повторите запрос', 409)
      }
      database.prepare(`INSERT INTO approval_revisions
        (id, share_code, share_created_at, shop_id, version, project_json, hash,
         price_minor, created_at, seal_json, otp_hash, preview_png)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`).run(
        id, code, share.created_at, account.shopId, next.version, JSON.stringify(next.project),
        next.hash, next.priceMinor, now, codeHash(id, confirmationCode), png,
      )
      database.exec('COMMIT')
    } catch (cause) { database.exec('ROLLBACK'); throw cause }
    // Код тек цехқа қайтады. Оны клиент телефонына жеткізу — UI/хабарлама интеграциясының міндеті.
    return NextResponse.json({ version: next.version, hash: next.hash, confirmationCode },
      { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('approval POST failed', cause)
    return error('Согласование временно недоступно', 500)
  }
}

export async function PUT(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const { code } = await params
    const ip = requestIp(request)
    if (isShareLimited(ip, code)) return error('Слишком много попыток', 429)
    const share = shareRow(code)
    if (!share) {
      if (!allowShareMiss(ip, code)) return error('Слишком много попыток', 429)
      return error('Код не найден или истёк', 404)
    }
    const body = await request.text()
    if (body.length > 200) return error('Слишком большой запрос', 413)
    let raw: unknown
    try { raw = JSON.parse(body) as unknown } catch { return error('Некорректный JSON', 400) }
    const parsed = confirmInput.safeParse(raw)
    if (!parsed.success) return error('Нужен 6-значный код подтверждения', 400)
    if (!allowComment(ip, `approval:${code}`)) return error('Слишком много попыток', 429)
    const latest = readVersion(code, share.created_at)
    if (!latest) return error('Согласование не начато', 404)
    if (latest.seal_json) return error('Версия уже подтверждена', 409)
    if (latest.attempts >= 5) return error('Слишком много попыток', 429)
    let current: ProjectFileV4
    try { current = publicProject(share.json) } catch { return error('Проект повреждён', 422) }
    if (await projectFingerprint(current) !== latest.hash || current.priceOverrides?.salePrice !== latest.price_minor) {
      return error('Проект изменился; нужно новое согласование', 409)
    }
    const actual = Buffer.from(codeHash(latest.id, parsed.data.confirmationCode), 'hex')
    if (!timingSafeEqual(actual, Buffer.from(latest.otp_hash, 'hex'))) {
      db().prepare('UPDATE approval_revisions SET attempts = attempts + 1 WHERE id = ? AND seal_json IS NULL').run(latest.id)
      return error('Неверный код подтверждения', 403)
    }
    const sealed = approveRevision(revision(latest), parsed.data.confirmationCode, Date.now())
    const database = db()
    database.exec('BEGIN IMMEDIATE')
    try {
      if (shareRow(code)?.json !== share.json || readVersion(code, share.created_at)?.id !== latest.id) {
        database.exec('ROLLBACK'); return error('Проект изменился; нужно новое согласование', 409)
      }
      const result = database.prepare('UPDATE approval_revisions SET seal_json = ? WHERE id = ? AND seal_json IS NULL')
        .run(JSON.stringify(sealed.seal), latest.id)
      database.exec('COMMIT')
      if (!result.changes) return error('Версия уже подтверждена', 409)
    } catch (cause) { database.exec('ROLLBACK'); throw cause }
    return NextResponse.json({ version: sealed.version, seal: sealed.seal }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('approval PUT failed', cause)
    return error('Согласование временно недоступно', 500)
  }
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const { code } = await params
    const ip = requestIp(request)
    if (isShareLimited(ip, code)) return error('Слишком много попыток', 429)
    const share = shareRow(code)
    if (!share) {
      if (!allowShareMiss(ip, code)) return error('Слишком много попыток', 429)
      return error('Код не найден или истёк', 404)
    }
    const url = new URL(request.url)
    const versionText = url.searchParams.get('version')
    const version = versionText === null ? undefined : Number(versionText)
    if (version !== undefined && (!Number.isSafeInteger(version) || version < 1)) return error('Неверная версия', 400)
    const row = readVersion(code, share.created_at, version)
    if (!row) return error('Версия не найдена', 404)
    if (url.searchParams.get('format') === 'pdf') {
      if (!row.seal_json) return error('Версия не подтверждена', 409)
      const fonts = {
        regular: new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/DejaVuSans-subset.ttf'))),
        bold: new Uint8Array(readFileSync(join(process.cwd(), 'public/fonts/DejaVuSans-Bold-subset.ttf'))),
      }
      const bytes = await approvalStampPdf({ revision: revision(row),
        projectName: (JSON.parse(row.project_json) as ProjectFileV4).name,
        fonts, ...(row.preview_png ? { previewPng: row.preview_png } : {}) })
      return new Response(Buffer.from(bytes), { headers: {
        'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="approval-v${row.version}.pdf"`,
        'Cache-Control': 'no-store',
      } })
    }
    let current: ProjectFileV4
    try { current = publicProject(share.json) } catch { return error('Проект повреждён', 422) }
    const matchesCurrent = await projectFingerprint(current) === row.hash &&
      current.priceOverrides?.salePrice === row.price_minor
    return NextResponse.json({ version: row.version, hash: row.hash, priceMinor: row.price_minor,
      status: matchesCurrent ? (row.seal_json ? 'approved' : 'pending') : 'changed',
      seal: row.seal_json ? revision(row).seal : null },
    { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('approval GET failed', cause)
    return error('Согласование временно недоступно', 500)
  }
}
