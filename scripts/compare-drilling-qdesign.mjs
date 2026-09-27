/**
 * qdesign CSV ↔ AisMebel Panel[].drilling. Run with `npx tsx` when using --fixture.
 * A mapping file records each qdesign panel's coordinate frame; it is required
 * because qdesign's CSV does not identify the panel's grain/cut origin.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const columns = ['cab_label', 'cab_uuid', 'panel', 'hole_id', 'type', 'side', 'x_mm', 'y_mm', 'dia_mm', 'depth_mm', 'through', 'source', 'preset_id', 'group_id']

function csvRecords(csv) {
  const records = []
  let record = [], field = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { record.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++
      record.push(field)
      if (record.some((value) => value !== '')) records.push(record)
      record = []; field = ''
    } else field += char
  }
  if (quoted) throw new Error('CSV: жабылмаған тырнақша')
  record.push(field)
  if (record.some((value) => value !== '')) records.push(record)
  return records
}

export function parseQdesignCsv(csv) {
  const records = csvRecords(csv.replace(/^\uFEFF/, ''))
  if (records.length === 0 || records[0].join(',') !== columns.join(',')) {
    throw new Error('qdesign CSV: 14 бағанның тақырыбы сәйкес емес')
  }
  return records.slice(1).map((cells, index) => {
    if (cells.length !== 14) throw new Error(`qdesign CSV ${index + 2}-жол: 14 баған керек, ${cells.length} бар`)
    const row = Object.fromEntries(columns.map((name, i) => [name, cells[i]]))
    for (const name of ['x_mm', 'y_mm', 'dia_mm', 'depth_mm']) {
      const value = Number(row[name])
      if (!Number.isFinite(value) || row[name] === '') throw new Error(`qdesign CSV ${index + 2}-жол: ${name} сан емес`)
      row[name] = value
    }
    if (!['true', 'false'].includes(row.through)) throw new Error(`qdesign CSV ${index + 2}-жол: through қате`)
    row.through = row.through === 'true'
    return row
  })
}

const purposes = {
  confirmat: 'confirmat', confirmat_pilot: 'confirmat',
  minifix_cam: 'minifix', minifix_dowel: 'minifix', minifix_pilot: 'minifix',
  shelf_pin: 'shelfPin', hinge_cup: 'hinge', hinge_dowel: 'hinge',
  hinge_plate: 'hinge', runner: 'runner', runner_screw: 'runner',
  dowel: 'dowel', handle: 'handle', leg_screw: 'leg', drawer_facade_euro_5: 'facadeScrew',
}

/**
 * map[panel] = {panelId,qLength?,qWidth?,axes?,reverseX?,reverseY?,
 *   originX?,originY?,sideMap?,frames?: { [qSide]: override }}.
 * A horizontal panel's broad face and its edge have different frames.
 * qLength/qWidth are qdesign's cut extents in the frame used by that hole.
 * qdesign face x/y are horizontal/vertical on a front, but our facade x/y
 * are vertical/horizontal. A side may count depth from the back, so reverseY.
 * originX/Y subtract band thickness only if qdesign reports finished coords.
 */
export function normalizeQdesignHoles(rows, map) {
  return rows.map((row) => {
    const panel = map[row.panel]
    if (!panel) throw new Error(`qdesign панель картасы жоқ: ${row.panel}`)
    const frame = { ...panel, ...panel.frames?.[row.side] }
    const purpose = row.type === 'custom' && row.preset_id === 'leg_screw'
      ? 'leg' : purposes[row.type]
    if (!purpose) throw new Error(`qdesign тесік түрі белгісіз: ${row.type} (${row.preset_id})`)
    const face = row.through ? 'through' : frame.sideMap?.[row.side]
    if (!face) throw new Error(`qdesign бет картасы жоқ: ${row.panel}/${row.side}`)
    if (!Number.isFinite(frame.qLength) || !Number.isFinite(frame.qWidth)) {
      throw new Error(`qdesign панель өлшемі жоқ: ${row.panel}`)
    }
    const qx = frame.reverseX ? frame.qLength - row.x_mm : row.x_mm
    const qy = frame.reverseY ? frame.qWidth - row.y_mm : row.y_mm
    const axes = frame.axes ?? 'xy'
    if (axes !== 'xy' && axes !== 'yx') throw new Error(`qdesign ось реті қате: ${axes}`)
    const x = (axes === 'xy' ? qx : qy) - (frame.originX ?? 0)
    const y = (axes === 'xy' ? qy : qx) - (frame.originY ?? 0)
    return { panelId: panel.panelId, purpose, face, x, y,
      diameter: row.dia_mm, depth: row.depth_mm, through: row.through,
      source: { panel: row.panel, holeId: row.hole_id, type: row.type, side: row.side } }
  })
}

export function normalizeOurHoles(panels, thicknessByPanel) {
  return panels.flatMap((panel) => panel.drilling.map((hole) => {
    const thickness = thicknessByPanel[panel.id]
    if (!Number.isFinite(thickness)) throw new Error(`Біздің панель қалыңдығы жоқ: ${panel.id}`)
    const through = !hole.face.startsWith('edge') && Math.abs(hole.depth - thickness) <= 0.001
    return { panelId: panel.id, purpose: hole.purpose, face: through ? 'through' : hole.face,
      x: hole.x, y: hole.y, diameter: hole.diameter, depth: hole.depth, through,
      source: { panel: panel.id, face: hole.face } }
  }))
}

function sameHole(a, b, tolerance) {
  return a.panelId === b.panelId && a.purpose === b.purpose && a.face === b.face
    && Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
    && Math.abs(a.diameter - b.diameter) <= 0.05 && Math.abs(a.depth - b.depth) <= 0.05
    && a.through === b.through
}

/** Maximum bipartite matching avoids counting one qdesign hole twice. */
export function compareDrilling(ours, qdesign, tolerance = 0.5) {
  const qOwner = Array(qdesign.length).fill(-1)
  const visit = (ourIndex, seen) => {
    for (let q = 0; q < qdesign.length; q++) {
      if (seen.has(q) || !sameHole(ours[ourIndex], qdesign[q], tolerance)) continue
      seen.add(q)
      if (qOwner[q] === -1 || visit(qOwner[q], seen)) { qOwner[q] = ourIndex; return true }
    }
    return false
  }
  for (let i = 0; i < ours.length; i++) visit(i, new Set())
  const matched = qOwner.filter((index) => index !== -1).length
  const matchedOurs = new Set(qOwner.filter((index) => index !== -1))
  const differences = [
    ...ours.flatMap((hole, i) => matchedOurs.has(i) ? [] : [{ kind: 'oursOnly', hole }]),
    ...qdesign.flatMap((hole, i) => qOwner[i] !== -1 ? [] : [{ kind: 'qdesignOnly', hole }]),
  ]
  return { oursCount: ours.length, qdesignCount: qdesign.length, matched,
    percent: Math.max(ours.length, qdesign.length) === 0 ? 100
      : Math.round(10000 * matched / Math.max(ours.length, qdesign.length)) / 100,
    differences }
}

async function fixturePanels(name) {
  const core = await import('../src/core/index.ts')
  if (['reference', 'fixed', 'minifix', 'inset'].includes(name)) {
    const project = core.parseProject(JSON.parse(readFileSync(new URL('../examples/wardrobe.json', import.meta.url), 'utf8')))
    const base = project.cabinets[0]
    const config = structuredClone(base)
    if (name === 'fixed') config.sections[0].contents[0].shelfKind = 'fixed'
    if (name === 'minifix') config.carcassJoint = 'minifix'
    if (name === 'inset') {
      config.sections[0].contents = []
      config.sections[0].fronts = { count: 1, mount: 'inset' }
    }
    const catalog = { materials: project.materials, edgeBands: project.edgeBands }
    return { panels: core.generateCabinet(config, catalog), catalog }
  }
  const template = name === 'kitchen' ? 'kitchen-base-full-600' : 'kitchen-base-drawers-600'
  const config = core.templateToCabinet(core.findTemplate(template), core.SEED_CATALOG)
  if (name === 'drawers-ball') config.drawerSystem = 'ball'
  else if (name === 'drawers-tandem') config.drawerSystem = 'tandem'
  else if (name !== 'kitchen') throw new Error(`Белгісіз fixture: ${name}`)
  return { panels: core.generateCabinet(config, core.SEED_CATALOG), catalog: core.SEED_CATALOG }
}

async function main(args) {
  const flag = (name) => { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1] }
  const csvPath = flag('--qdesign'), mappingPath = flag('--mapping')
  if ((!csvPath || !mappingPath) && !args.includes('--dump-ours')) {
    throw new Error('Қолдану: npx tsx scripts/compare-drilling-qdesign.mjs --fixture reference --qdesign file.csv --mapping map.json')
  }
  let panels, thicknessByPanel
  if (flag('--fixture')) {
    const built = await fixturePanels(flag('--fixture'))
    panels = built.panels
    thicknessByPanel = Object.fromEntries(panels.map((panel) => [panel.id,
      built.catalog.materials.find((material) => material.id === panel.materialId)?.thickness]))
  } else {
    const oursPath = flag('--ours')
    if (!oursPath) throw new Error('--fixture не --ours керек')
    const data = JSON.parse(readFileSync(oursPath, 'utf8'))
    panels = data.panels; thicknessByPanel = data.thicknessByPanel
  }
  const ours = normalizeOurHoles(panels, thicknessByPanel)
  if (args.includes('--dump-ours')) { console.log(JSON.stringify(ours, null, 2)); return }
  const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'))
  const qdesign = normalizeQdesignHoles(parseQdesignCsv(readFileSync(csvPath, 'utf8')), mapping)
  console.log(JSON.stringify(compareDrilling(ours, qdesign), null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1 })
}
