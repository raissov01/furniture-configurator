/** HTTP body-ді шекке дейін ғана жадыға жинайды; шек асқанда ағынды тоқтатады. */
export async function readLimitedBody(request: Request, maximum: number): Promise<Uint8Array | null> {
  const advertised = Number(request.headers.get('content-length'))
  if (Number.isFinite(advertised) && advertised > maximum) return null
  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maximum) {
        await reader.cancel()
        return null
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}
