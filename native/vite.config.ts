import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import { OFFLINE_PAGE, resolveHybridTarget } from '../capacitor.config'

const root = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const target = resolveHybridTarget(process.env['AISMEBEL_APP_URL'])

/**
 * Capacitor `errorPath` тек БІР URL-ды (https://<хост>/aismebel-offline.html)
 * қосымша ішінен береді; беттің /assets/* сұраулары желіге кетіп, офлайнда құлар еді.
 * Сондықтан офлайн бет JS пен CSS-ті ішіне салған бір HTML файл болып шығады.
 */
function inlineOfflinePage(): Plugin {
  return {
    name: 'aismebel-inline-offline-page',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') this.error('index.html жоқ')
      let page = String(html.source)
      for (const [name, item] of Object.entries(bundle)) {
        if (name === 'index.html') continue
        const ref = new RegExp(`<link[^>]*href="\\./${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>|<script[^>]*src="\\./${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></script>`)
        if (!ref.test(page)) continue
        if (item.type === 'chunk') {
          const code = item.code.replace(/<\/script/gi, '<\\/script')
          page = page.replace(ref, () => `<script type="module">${code}</script>`)
        } else if (name.endsWith('.css')) {
          const css = String(item.source).replace(/<\/style/gi, '<\\/style')
          page = page.replace(ref, () => `<style>${css}</style>`)
        }
      }
      if (/(?:src|href)="\.\/assets\//.test(page)) this.error('офлайн бетте сыртқы ассет қалды')
      this.emitFile({ type: 'asset', fileName: OFFLINE_PAGE, source: page })
    },
  }
}

export default defineConfig({
  root,
  base: './',
  resolve: { alias: { '@': projectRoot } },
  define: {
    __AISMEBEL_START_URL__: JSON.stringify(target.startUrl),
    __AISMEBEL_HEALTH_URL__: JSON.stringify(`${target.origin}/api/v1/health`),
  },
  plugins: [inlineOfflinePage()],
  build: { outDir: fileURLToPath(new URL('../native-dist', import.meta.url)), emptyOutDir: true, chunkSizeWarningLimit: 5000 },
})
