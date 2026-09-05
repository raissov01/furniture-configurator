import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

/**
 * Құрастырудың белгісі.
 *
 * ⚠ ҚЫЗМЕТТІК ЖҰМЫСШЫҒА КЕРЕК. Ол статиканы кэштейді, ал жаңа нұсқа
 * шыққанда ЕСКІ кэшті тастауы керек. Кэштің аты осы белгіден құралады,
 * сондықтан әр деплой өз кэшін алады да, адам ескі бетте отырып қалмайды
 * (2026-09-04-те дәл сол болды: SW ескі бетті ұстап тұрды).
 */
const BUILD_ID = String(Date.now())

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  /*
   * Docker үшін: Next өзіне керек модульдерді ғана жинайды да, образ
   * node_modules-сыз шығады (1 vCPU VPS-те бұл маңызды).
   *
   * ⚠ ВЕРСЕЛЬДЕ ЖАРАМАЙДЫ. Онда билд өзі өтеді, бірақ соңында платформа
   * `.next/next-server.js.nft.json` іздейді де, standalone режимінде ол
   * файл жасалмағандықтан деплой құлайды («ENOENT ... nft.json»). Сол
   * себепті белгі ТЕК өз машинамызда/Docker-де қойылады; Vercel өзінің
   * `VERCEL` айнымалысымен танылады.
   */
  ...(process.env['VERCEL'] ? {} : { output: 'standalone' as const }),
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
