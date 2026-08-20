import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` әйтпесе біздің CLAUDE.md-ке өз блогын жазып қояды.
  // CLAUDE.md — жобаның спеці, оны құрал өзгертпеуі керек.
  agentRules: false,
  turbopack: {
    // Жоба түбірі айқын көрсетілмесе, Turbopack жоғарыдағы бөтен
    // package-lock.json-ды тауып, жаңылыс түбір таңдайды.
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
}

export default nextConfig
