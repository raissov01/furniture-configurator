import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = fileURLToPath(new URL('../', import.meta.url))

export default defineConfig({
  root,
  base: './',
  resolve: { alias: { '@': projectRoot } },
  build: { outDir: fileURLToPath(new URL('../native-dist', import.meta.url)), emptyOutDir: true },
})
