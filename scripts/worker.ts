import { claimJob, completeJob, extendJobLease, failJob, type JobRow } from '../lib/server/jobs'
import { objectStorage } from '../lib/server/objectStorage'
import { readProject } from '../lib/server/store'
import { applyInstallationSync } from '../lib/server/installation'
import { parseInstallationAction } from '../src/core/installation'
import { cutListToXlsx, flattenTree, parseProjectV4 } from '../src/core/index'
import { allowAiRequest } from '../lib/server/rateLimit'
import { MAX_RENDER_BYTES, renderScene } from '../lib/server/renderScene'
import { db } from '../lib/server/db'

type RenderPayload = { key: string; hint?: string; style?: string }
type XlsxPayload = { projectId: string }

export async function processJob(job: JobRow): Promise<unknown> {
  const payload: unknown = JSON.parse(job.payload_json)
  if (job.kind === 'render') {
    const input = payload as RenderPayload
    const image = await objectStorage().get(job.shop_id, input.key)
    if (!image || image.contentType !== 'image/png') throw new Error('Рендер үшін PNG табылмады')
    if (image.bytes.byteLength > MAX_RENDER_BYTES) throw new Error('Снимок слишком большой')
    if (!allowAiRequest(job.shop_id, 'render')) throw new Error('Цехтың ИИ-рендер лимиті бітті')
    const b64 = await renderScene(image.bytes, input.hint, input.style)
    const key = await objectStorage().put(job.shop_id, 'render', Buffer.from(b64, 'base64'), 'image/png')
    return { key }
  }
  if (job.kind === 'xlsx') {
    const { projectId } = payload as XlsxPayload
    const stored = readProject(job.shop_id, projectId)
    if (!stored) throw new Error('Жоба табылмады')
    const project = parseProjectV4(stored)
    const catalog = { materials: project.materials, edgeBands: project.edgeBands }
    const scene = flattenTree(project.root, catalog, project.settings, project.layers)
    const panels = scene.nodes.flatMap((node) => node.panels)
    const bytes = cutListToXlsx(panels, catalog, project.name)
    const key = await objectStorage().put(job.shop_id, 'export', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return { key }
  }
  if (job.kind === 'installation_sync') {
    return applyInstallationSync(job.shop_id, parseInstallationAction(payload), Date.now())
  }
  throw new Error(`Белгісіз кезек түрі: ${job.kind}`)
}

async function main(): Promise<void> {
  // A fresh PostgreSQL volume needs schema migrations before the first job query.
  db().prepare('SELECT 1 AS ok').get()
  let running = true
  process.on('SIGTERM', () => { running = false })
  process.on('SIGINT', () => { running = false })
  while (running) {
    const job = await claimJob()
    if (!job) { await new Promise((resolve) => setTimeout(resolve, 1500)); continue }
    const heartbeat = setInterval(() => { void extendJobLease(job).catch((cause) => console.error(`job ${job.id} lease failed`, cause)) }, 60_000)
    try { await completeJob(job, await processJob(job)) }
    catch (cause) { console.error(`job ${job.id} failed`, cause); await failJob(job, cause) }
    finally { clearInterval(heartbeat) }
  }
}

if (process.argv[1]?.endsWith('worker.ts')) main().catch((cause) => { console.error(cause); process.exitCode = 1 })
