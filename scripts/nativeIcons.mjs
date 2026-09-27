/** Generate platform raster assets from AisMebel's own SVG icon. */
import sharp from 'sharp'
import { readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'

const icon = 'public/icon.svg'
const paper = '#f7f5f0'

async function replacePng(path, create) {
  const { width, height } = await sharp(path).metadata()
  if (!width || !height) throw new Error(`Missing image size: ${path}`)
  const temp = `${path}.new`
  const pipeline = await create(width, height)
  await pipeline.png().toFile(temp)
  await rename(temp, path)
}

async function rasterIcon(path) {
  await replacePng(path, (width, height) => sharp(icon).resize(width, height).flatten({ background: '#1f2a37' }))
}

async function rasterSplash(path) {
  await replacePng(path, async (width, height) => {
    const size = Math.round(Math.min(width, height) * 0.3)
    const logo = await sharp(icon).resize(size, size).png().toBuffer()
    return sharp({ create: { width, height, channels: 4, background: paper } })
      .composite([{ input: logo, gravity: 'centre' }])
  })
}

for (const density of await readdir('android/app/src/main/res')) {
  const dir = join('android/app/src/main/res', density)
  if (density.startsWith('mipmap-')) {
    for (const name of await readdir(dir)) if (name.startsWith('ic_launcher') && name.endsWith('.png')) {
      await rasterIcon(join(dir, name))
    }
  } else if (density.startsWith('drawable')) {
    for (const name of await readdir(dir)) if (name.startsWith('splash') && name.endsWith('.png')) {
      await rasterSplash(join(dir, name))
    }
  }
}
await rasterIcon('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
for (const name of await readdir('ios/App/App/Assets.xcassets/Splash.imageset')) {
  if (name.endsWith('.png')) await rasterSplash(join('ios/App/App/Assets.xcassets/Splash.imageset', name))
}
