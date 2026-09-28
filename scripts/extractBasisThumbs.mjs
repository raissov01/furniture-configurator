#!/usr/bin/env node
/**
 * Extract standard embedded PNG thumbnails from the client's own BASIS kitchen
 * module archives. No B3D/FR3D format parsing. Proprietary furniture hardware
 * is deliberately excluded from the public catalog.
 */
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { extractEmbeddedPng, moduleKey, previewAssetName, privateOutputAllowed } from './basisThumbs.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arguments_ = process.argv.slice(2)
const privateIndex = arguments_.indexOf('--hardware-private')
const privateDir = privateIndex >= 0 ? arguments_[privateIndex + 1] : undefined
if (privateIndex >= 0 && !privateDir) throw new Error('--hardware-private requires a directory')
const zip = arguments_.find((arg, index) => index !== privateIndex && index !== privateIndex + 1 && !arg.startsWith('--'))
  ?? path.join(process.env.HOME, 'Downloads', 'Базис библиотеки.zip')
const out = privateDir ? path.resolve(privateDir) : path.join(root, 'public/library/basis')
if (privateDir && !privateOutputAllowed(out, path.join(root, 'public'))) throw new Error('Hardware thumbnails cannot be public')
const manifestPath = path.join(out, privateDir ? 'hardware-manifest.json' : 'manifest.json')
const catalogPath = privateDir ? null : path.join(out, 'catalog.json')
const archives = [
  { system: 'standard', name: '2023 Модули КУХНИ для БАЗИС-Мебельщик.rar' },
  { system: 'gola', name: '2023 Модули КУХНИ-Gola для БАЗИС-Мебельщик.rar' },
]
if (privateDir) archives.splice(0, archives.length, { system: 'hardware', name: '2023 Фурнитура для БАЗИС-Мебельщик.rar' })

async function run(command, args, stdoutFile) {
  const child = spawn(command, args, { stdio: ['ignore', stdoutFile ? 'pipe' : 'inherit', 'inherit'] })
  const output = stdoutFile ? pipeline(child.stdout, createWriteStream(stdoutFile)) : Promise.resolve()
  const exit = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)))
  })
  await Promise.all([output, exit])
}

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* files(full)
    else if (entry.isFile() && (privateDir ? /\.fr3d$/iu : /\.b3d$/iu).test(entry.name)) yield full
  }
}

async function main() {
  if (!existsSync(zip)) throw new Error(`Archive missing: ${zip}`)
  await mkdir(out, { recursive: true })
  const scratch = await mkdtemp(path.join(tmpdir(), 'aismebel-basis-'))
  const manifest = { version: 1, modules: {}, paths: {} }
  const converted = new Set()
  try {
    for (const { system, name } of archives) {
      const rar = path.join(scratch, name)
      const extracted = path.join(scratch, system)
      await mkdir(extracted)
      console.log(`[${system}] ZIP → RAR`)
      await run('unzip', ['-p', zip, `Базис библиотеки/${name}`], rar)
      console.log(`[${system}] RAR → scratch`)
      await run('unrar', ['x', '-idq', '-o+', rar, extracted + path.sep])
      let scanned = 0, found = 0
      for await (const filename of files(extracted)) {
        scanned++
        const bytes = await readFile(filename)
        const png = extractEmbeddedPng(bytes)
        if (!png) continue
        const asset = previewAssetName(png)
        const target = path.join(out, asset)
        if (!converted.has(asset) && !existsSync(target)) {
          await sharp(png).resize(privateDir ? 128 : 160, privateDir ? 128 : 160, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(target)
        }
        converted.add(asset)
        const key = privateDir ? path.relative(extracted, filename).normalize('NFC') : moduleKey(system, path.basename(filename))
        const url = privateDir ? asset : `/library/basis/${asset}`
        manifest.modules[key] = url
        manifest.paths[`${system}/${path.relative(extracted, filename).split(path.sep).join('/')}`.normalize('NFC')] = url
        found++
        if (scanned % 250 === 0) console.log(`[${system}] ${scanned} scanned, ${found} previews`)
      }
      console.log(`[${system}] done: ${found}/${scanned}`)
      await rm(extracted, { recursive: true, force: true })
      await rm(rar, { force: true })
    }
    await writeFile(manifestPath, JSON.stringify(manifest) + '\n')
    if (catalogPath) await writeFile(catalogPath, JSON.stringify(manifest.modules) + '\n')
    console.log(`manifest: ${Object.keys(manifest.modules).length} records, ${converted.size} assets`)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
