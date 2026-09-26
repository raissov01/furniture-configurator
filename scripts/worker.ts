import { claimJob, completeJob, extendJobLease, failJob, type JobRow } from '../lib/server/jobs'
import { objectStorage } from '../lib/server/objectStorage'
import { readProject } from '../lib/server/store'
import { applyInstallationSync } from '../lib/server/installation'
import { parseInstallationAction } from '../src/core/installation'
import { cutListToXlsx, flattenTree, parseProjectV4 } from '../src/core/index'

type RenderPayload = { key: string; hint?: string; style?: string }
type XlsxPayload = { projectId: string }

export async function processJob(job: JobRow): Promise<unknown> {
  const payload: unknown = JSON.parse(job.payload_json)
  if (job.kind === 'render') {
    const input = payload as RenderPayload
    const image = await objectStorage().get(job.shop_id, input.key)
    if (!image || image.contentType !== 'image/png') throw new Error('Рендер үшін PNG табылмады')
    const { POST } = await import('../app/api/render/route')
    const response = await POST(new Request('http://worker/api/render', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: `data:image/png;base64,${Buffer.from(image.bytes).toString('base64')}`, hint: input.hint, style: input.style }),
    }))
    const result = await response.json() as { image?: string; error?: string }
    if (!response.ok || !result.image?.startsWith('data:image/png;base64,')) throw new Error(result.error ?? 'Рендер жасалмады')
    const key = await objectStorage().put(job.shop_id, 'render', Buffer.from(result.image.slice('data:image/png;base64,'.length), 'base64'), 'image/png')
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
