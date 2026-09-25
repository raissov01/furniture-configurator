/** Цех берген PRO100 textures.ini мәтінін оқу. Сурет жолы тек метадерек; файл ашылмайды. */
export type Pro100Texture = {
  name: string
  mapSizeMm: { x: number; y: number }
  diffuse?: number
  specular?: number
  diffuseRgb?: { r: number; g: number; b: number }
  specularRgb?: { r: number; g: number; b: number }
  specExponent?: number
  specProportion?: number
  transparency?: number
  reflectivity?: number
  imageFile?: string
}
export type Pro100TexturePreview = { textures: Pro100Texture[]; errors: { lineNumber: number; reason: string }[] }
type Section = { name: string; lineNumber: number; fields: Record<string, string> }

export function parsePro100Textures(input: string): Pro100TexturePreview {
  const textures: Pro100Texture[] = [], errors: Pro100TexturePreview['errors'] = []
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/)
  let section: Section | null = null
  const sections: Section[] = []
  const finish = () => { if (section) sections.push(section) }
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) return
    const heading = /^\[([^\]]+)\]$/.exec(line)
    if (heading) { finish(); section = { name: heading[1]!.trim(), lineNumber: i + 1, fields: {} }; return }
    const pair = /^([^=]+)=(.*)$/.exec(line)
    if (!pair || !section) { errors.push({ lineNumber: i + 1, reason: 'INI жолы жарамсыз' }); return }
    section.fields[pair[1]!.trim().toLowerCase()] = pair[2]!.trim()
  })
  finish()
  const defaults = sections.find((item) => item.name.toLowerCase() === 'default')?.fields ?? {}
  for (const item of sections) {
    if (item.name.toLowerCase() === 'default') continue
    const { name, lineNumber } = item
    const fields = { ...defaults, ...item.fields }
    const x = Number(fields['xmm']), y = Number(fields['ymm'])
    if (!Number.isSafeInteger(x) || x <= 0) { errors.push({ lineNumber, reason: 'xmm оң бүтін мм болуы керек' }); continue }
    if (!Number.isSafeInteger(y) || y <= 0) { errors.push({ lineNumber, reason: 'ymm оң бүтін мм болуы керек' }); continue }
    const texture: Pro100Texture = { name, mapSizeMm: { x, y } }
    let invalid = false
    for (const key of ['diffuse', 'specular'] as const) if (fields[key] !== undefined) {
      const value = Number(fields[key])
      if (!Number.isFinite(value) || value < 0) { errors.push({ lineNumber, reason: `${key} жарамсыз` }); invalid = true; break }
      texture[key] = value
    }
    if (invalid) continue
    for (const [prefix, key] of [['diffuse', 'diffuseRgb'], ['specular', 'specularRgb']] as const) {
      const values = ['red', 'green', 'blue'].map((color) => fields[`${prefix}${color}`])
      if (values.every((value) => value === undefined)) continue
      const numbers = values.map((value) => Number(value))
      if (values.some((value) => value === undefined || value === '') || numbers.some((value) => !Number.isFinite(value) || value < 0)) {
        errors.push({ lineNumber, reason: `${prefix} RGB жарамсыз` }); invalid = true; break
      }
      texture[key] = { r: numbers[0]!, g: numbers[1]!, b: numbers[2]! }
    }
    if (invalid) continue
    for (const [field, key] of [['specexponent', 'specExponent'], ['specproportion', 'specProportion'],
      ['transparency', 'transparency'], ['reflectivity', 'reflectivity']] as const) if (fields[field] !== undefined) {
      const value = Number(fields[field])
      if (!Number.isFinite(value) || value < 0) { errors.push({ lineNumber, reason: `${field} жарамсыз` }); invalid = true; break }
      texture[key] = value
    }
    if (invalid) continue
    const imageFile = fields['file'] ?? fields['image'] ?? fields['bitmap'] ?? (/\.(?:jpe?g|png|bmp|webp)$/iu.test(name) ? name : undefined)
    if (imageFile) {
      if (/\0|\.\./u.test(imageFile) || /^[a-z]+:\/\//iu.test(imageFile)) { errors.push({ lineNumber, reason: 'Сурет жолы жарамсыз' }); continue }
      texture.imageFile = imageFile
    }
    textures.push(texture)
  }
  return { textures, errors }
}
