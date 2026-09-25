/**
 * ЖАЛҒАН Базис: скрипттің денесін Node `vm`-де аяғына дейін жүргізу үшін.
 *
 * ⚠ Мұндағы геометрия келісімі — БІЗДІҢ болжамымыз (docs/basis/script-export.md
 * «Тексерілмеген»). Ол Базисті тексермейді, тек скрипттің өз логикасын:
 * топтау, сәйкестендіру, есеп, audit файлы. Шын Базистің жауабы тек тестер
 * қайтарған audit JSON-нан белгілі болады.
 */
import vm from 'node:vm'
import type { BasisScriptData } from '../src/core/index'

export type Call = { fn: string; args: unknown[] }
type V = { x: number; y: number; z: number }

export type FakeOptions = {
  /** Қай түрге Базис крепежі таңдалған (true) */
  mapped: Record<string, boolean>
  /** Таңдалған кромканың қалыңдығы (берілмесе — атауынан); 0 — таңдалмаған */
  buttThickness?: number
  /** `fastenerOperations` бар ма (жаңа API) */
  holeApi?: boolean
  /** Базис қайтаратын тесіктерді бұзу (audit-тың MISMATCH жолын тексеру) */
  corruptHoles?: (panelIndex: number, holes: FakeHole[]) => FakeHole[]
  modelFilename?: string
}

export type FakeHole = { Diameter: number; Depth: number; Position: V; Fastener: { Name: string; UID: number } | null }

export function runInFakeBazis(script: string, options: FakeOptions) {
  const calls: Call[] = []
  const alerts: string[] = []
  const files = new Map<string, string>()
  let material = { name: '', t: 0 }
  let finished = false
  let uid = 1
  const vec = (x: number, y: number, z: number): V => ({ x, y, z })
  const created: Record<string, unknown>[] = []

  function panel(kind: 'front' | 'horiz' | 'vert', a: number, b: number, c: number, d: number, e: number) {
    const t = material.t
    const w = c - a
    const h = d - b
    // Болжам (A1): контур (u, v) → әлем; қалыңдық нормаль бойымен ОҢ жаққа.
    const local = (u: number, v: number, n: number): V =>
      kind === 'front' ? vec(a + u, b + v, e + n)
        : kind === 'horiz' ? vec(a + u, e + n, b + v)
          : vec(e + n, b + v, a + u)
    const toLocal = (p: V): V =>
      kind === 'front' ? vec(p.x - a, p.y - b, p.z - e)
        : kind === 'horiz' ? vec(p.x - a, p.z - b, p.y - e)
          : vec(p.z - a, p.y - b, p.x - e)
    const lines = [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]].map(([x1, y1, x2, y2]) => ({
      IsLine: () => true,
      AsLine: () => ({ Pos1: { x: x1, y: y1 }, Pos2: { x: x2, y: y2 } }),
    }))
    const lo = local(0, 0, 0)
    const hi = local(w, h, t)
    const butts: Record<string, unknown>[] = []
    const obj: Record<string, unknown> = {
      Name: '', UID: uid++, TextureOrientation: 0, MaterialName: material.name, Thickness: t,
      ContourWidth: w, ContourHeight: h, GSize: vec(w, h, t),
      Contour: { Count: 4, Objects: lines },
      GabMin: vec(Math.min(lo.x, hi.x), Math.min(lo.y, hi.y), Math.min(lo.z, hi.z)),
      GabMax: vec(Math.max(lo.x, hi.x), Math.max(lo.y, hi.y), Math.max(lo.z, hi.z)),
      Position: lo,
      Butts: { get Count() { return butts.length }, Butts: butts },
      ToGlobal: (p: V) => local(p.x, p.y, p.z),
      ToObject: (p: V) => toLocal(p),
      NToGlobal: () => (kind === 'front' ? vec(0, 0, 1) : kind === 'horiz' ? vec(0, 1, 0) : vec(1, 0, 0)),
      AddButt(prop: { Thickness: number }, elem: number) {
        const butt = { ElemIndex: elem, Material: 'butt', Thickness: prop.Thickness, ClipPanel: false, Sign: '' }
        butts.push(butt)
        return butt
      },
      Build() {},
    }
    calls.push({ fn: kind, args: [a, b, c, d, e] })
    created.push(obj)
    return obj
  }

  const mounted: { kind: string; panels: unknown[]; point: V; obj: Record<string, unknown> }[] = []
  function fastenerObj(kind: string, panels: unknown[], x: number, y: number, z: number) {
    const obj: Record<string, unknown> = {
      Name: `Базис ${kind}`, UID: uid++, Position: vec(x, y, z),
      GabMin: vec(x - 5, y - 5, z - 5), GabMax: vec(x + 5, y + 5, z + 5),
      NToGlobal: () => vec(0, 0, 1),
      FindFastenedObjects: () => panels,
    }
    mounted.push({ kind, panels, point: vec(x, y, z), obj })
    return obj
  }
  const furniture = (kind: string) => ({
    Mount: (p1: unknown, p2: unknown, x: number, y: number, z: number) => {
      calls.push({ fn: `Mount:${kind}`, args: [p1, p2, x, y, z] })
      return fastenerObj(kind, [p1, p2], x, y, z)
    },
    Mount1: (p: unknown, x: number, y: number, z: number, a: number) => {
      calls.push({ fn: `Mount1:${kind}`, args: [p, x, y, z, a] })
      return fastenerObj(kind, [p], x, y, z)
    },
  })

  const buttons: { OnClick: null | (() => void) }[] = []
  const furnProps: { label: string; Value: unknown }[] = []
  const buttProps: { label: string; Thickness: number; Width: number }[] = []
  const group = (): Record<string, unknown> => ({
    NewFurniture: (label: string) => { const p = { label, Value: null as unknown }; furnProps.push(p); return p },
    NewButt: (label: string) => { const p = { label, Thickness: 0, Width: 0 }; buttProps.push(p); return p },
  })
  const root: Record<string, unknown> = {
    NewBool: () => ({ Value: false }),
    NewGroup: () => group(),
    NewButton: () => { const b = { OnClick: null as null | (() => void) }; buttons.push(b); return b },
    Load: () => {
      // «Сақталған таңдау»: Load шақырылғанда мәндер қойылады.
      for (const p of furnProps) {
        const kind = Object.keys(options.mapped).find((k) => p.label.includes(`[${k}]`))
        if (kind && options.mapped[kind]) p.Value = furniture(kind)
      }
      // Тестер кромканы өз атауына сай таңдайды: «(0.4 мм)» → 0.4.
      for (const p of buttProps) {
        p.Thickness = options.buttThickness ?? Number(/\(([\d.]+) мм\)/.exec(p.label)?.[1] ?? 0)
      }
      return true
    },
    Save: () => {},
  }

  const Action = {
    Properties: root,
    ModelFilename: options.modelFilename ?? 'C:\\Models\\test.b3d',
    OnStart: null as null | (() => void),
    Continue: () => {},
    Finish: () => { finished = true },
  }

  const ctx: Record<string, unknown> = {
    Action,
    Model: {},
    AxisZ: vec(0, 0, 1),
    ActiveMaterial: { Make: (name: string, t: number) => { material = { name, t } } },
    TextureOrientation: { None: 0, Horizontal: 1, Vertical: 2 },
    NewVector: vec,
    AddFrontPanel: (...a: number[]) => panel('front', a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
    AddHorizPanel: (...a: number[]) => panel('horiz', a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
    AddVertPanel: (...a: number[]) => panel('vert', a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
    BeginBlock: (name: string) => { calls.push({ fn: 'BeginBlock', args: [name] }) },
    EndBlock: () => { calls.push({ fn: 'EndBlock', args: [] }) },
    alert: (s: string) => { alerts.push(s) },
    system: {
      apiVersion: 7,
      log: () => {},
      writeTextFile: (path: string, text: string) => { files.set(path, text) },
      askFileNameSave: () => 'C:\\chosen\\audit.json',
    },
  }

  if (options.holeApi !== false) {
    // Жаңа API-дің жалған нұсқасы: Базис біз күткен тесіктерді «бұрғылайды».
    ctx.fastenerOperations = {
      NewHoleDrilling: () => ({
        AddBody: () => {},
        AddFasteners: () => {},
        DrillHoles: () => {},
        Bodies: {
          FindBodyInfo: (p: unknown) => {
            const data = ctx.DATA as BasisScriptData
            const built = data.panels.map((rec, i) => ({ rec, i })).filter(({ rec }) => rec.skip === null)
            const index = built[created.indexOf(p as Record<string, unknown>)]!.i
            let holes: FakeHole[] = []
            // Скрипт крепежді түйін ретімен, түйін ішінде индекс ретімен қояды.
            const order = data.fasteners.map((f, j) => ({ f, j }))
              .filter(({ f }) => f.skip === null && options.mapped[f.kind])
              .sort((x, y) => x.f.node - y.f.node || x.j - y.j)
            mounted.forEach((m, k) => {
              const f = order[k]!.f
              for (const h of f.holes) {
                if (h.panel !== index) continue
                holes.push({
                  Diameter: h.diameter, Depth: h.depth,
                  Position: vec(h.point[0], h.point[1], h.point[2]),
                  Fastener: { Name: m.obj.Name as string, UID: m.obj.UID as number },
                })
              }
            })
            if (options.corruptHoles) holes = options.corruptHoles(index, holes)
            return { Holes: { Count: holes.length, Items: holes } }
          },
        },
      }),
    }
  }

  vm.runInNewContext(script, ctx)
  const onStart = (ctx.Action as typeof Action).OnStart
  if (typeof onStart !== 'function') throw new Error('Action.OnStart орнатылмаған')
  onStart()
  // Сәйкестендіру толық болмаса, скрипт «Построить» батырмасын күтеді —
  // тестер оны басады.
  if (!finished) for (const b of buttons) b.OnClick?.()

  const auditJson = [...files.entries()].find(([k]) => k.endsWith('.json'))
  return {
    calls,
    alerts,
    files,
    isFinished: () => finished,
    data: ctx.DATA as BasisScriptData,
    audit: auditJson ? (JSON.parse(auditJson[1]) as Record<string, unknown>) : null,
    auditPath: auditJson?.[0] ?? null,
  }
}
