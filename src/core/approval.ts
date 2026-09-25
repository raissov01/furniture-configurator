/** Клиент келіскен конфигурация: UI-ға тәуелсіз, өзгермейтін нұсқа дерегі. */
export type ApprovalSeal = {
  hash: string
  /** Тиын, бүтін сан. */
  priceMinor: number
  /** UTC Unix миллисекунды. */
  approvedAt: number
  confirmationCode: string
}

export type ApprovalRevision<T> = {
  version: number
  project: T
  hash: string
  priceMinor: number
  createdAt: number
  seal: ApprovalSeal | null
}

function validInteger(value: number, field: string, positive = false): void {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new Error(`${field}: қауіпсіз бүтін сан қажет`)
  }
}

/** JSON семантикасын сақтап, нысан кілттерін барлық деңгейде реттейді. */
export function canonicalJson(value: unknown): string {
  const source = JSON.stringify(value)
  if (source === undefined) throw new Error('project: JSON-ға айналатын мән қажет')
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort)
    if (item !== null && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => [key, sort(child)]))
    }
    return item
  }
  return JSON.stringify(sort(JSON.parse(source) as unknown))
}

/** Web Crypto Node-та да, телефон браузерінде де бар; нәтиже 64 таңбалы SHA-256. */
export async function projectFingerprint(project: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonicalJson(project))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function snapshot<T>(project: T): T {
  return JSON.parse(JSON.stringify(project)) as T
}

function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeJson(child)
    Object.freeze(value)
  }
  return value
}

export async function createApprovalRevision<T>(
  project: T, priceMinor: number, createdAt: number, version = 1,
): Promise<ApprovalRevision<T>> {
  validInteger(priceMinor, 'priceMinor')
  validInteger(createdAt, 'createdAt')
  validInteger(version, 'version', true)
  const copy = snapshot(project)
  return freezeJson({ version, project: copy, hash: await projectFingerprint(copy), priceMinor, createdAt, seal: null })
}

/** Растауды тексеру (OTP салыстыру) сервердің міндеті; мұнда құжат дерегі бекітіледі. */
export function approveRevision<T>(revision: ApprovalRevision<T>, confirmationCode: string, approvedAt: number): ApprovalRevision<T> {
  if (revision.seal) throw new Error('revision: нұсқа бұрын мақұлданған')
  if (!/^\d{6}$/.test(confirmationCode)) throw new Error('confirmationCode: 6 цифр қажет')
  validInteger(approvedAt, 'approvedAt')
  if (approvedAt < revision.createdAt) throw new Error('approvedAt: нұсқадан бұрын болмауы керек')
  return freezeJson({ ...revision, project: snapshot(revision.project),
    seal: { hash: revision.hash, priceMinor: revision.priceMinor, approvedAt, confirmationCode } })
}

/** Мақұлданған ескі нұсқа сақталады; кез келген мазмұн/баға өзгерісі жаңа нұсқа. */
export async function reviseApproval<T>(
  previous: ApprovalRevision<T>, project: T, priceMinor: number, createdAt: number,
): Promise<ApprovalRevision<T>> {
  const next = await createApprovalRevision(project, priceMinor, createdAt, previous.version + 1)
  if (next.hash === previous.hash && next.priceMinor === previous.priceMinor) {
    throw new Error('project: өзгеріс жоқ')
  }
  return next
}
