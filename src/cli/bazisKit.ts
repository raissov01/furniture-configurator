#!/usr/bin/env tsx
/**
 * Базис тест-жинағын жазу:
 *   npm run bazis:kit -- [--out dist/]
 *
 * Нәтиже — `bazis-test-kit.js` (UTF-8 + BOM). Оны Базисі бар тестерге
 * жібереміз: ол Scripts қалтасына салып, бір рет іске қосады да, audit
 * файлын қайтарады (`npm run bazis:audit -- <файл>`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BASIS_TEST_KIT_NAME, basisTestKitScript, catalogOf, defaultShopProfile } from '../core/index'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const outDir = resolve(arg('out', 'dist'))
mkdirSync(outDir, { recursive: true })
const text = basisTestKitScript(catalogOf(defaultShopProfile()))
const file = join(outDir, `${BASIS_TEST_KIT_NAME}.js`)
writeFileSync(file, `﻿${text}`, 'utf8')
console.log(`Тест-жинақ: ${file}`)
