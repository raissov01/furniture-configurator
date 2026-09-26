/** Сағат кері кеткенде бекітуді қате сервер күйі деп көрсетпеу үшін. */
export function isApprovalClockError(cause: unknown): boolean {
  return cause instanceof Error && /approvedAt|уақыт жарамсыз/i.test(cause.message)
}
