/**
 * Базис-Мебельщик `.b3d` / `.fr3d` контейнері («BZ85») — ТӨМЕН ДЕҢГЕЙЛІ оқу.
 *
 * Формат картасы: `docs/basis/b3d-format.md`. Мұнда тек байттан типтелген
 * ағашқа дейін: мағынасы (панель, кромка, тесік) `basisB3d.ts`-те.
 *
 * Таза TypeScript (CLAUDE.md §3): React/three жоқ, Node-та да, браузерде де
 * жүреді. zlib — жобада бар `fflate`.
 */
import { inflateSync } from 'fflate'
import { ConfigValidationError } from '../errors'

/** Бір түйін. Ата-түйінде бірдей кілт бірнеше рет кездесуі мүмкін (`Obj`, `Butt`). */
export type BzNode =
  | { key: string; type: 'object'; children: BzNode[] }
  | { key: string; type: 'bool'; value: boolean }
  | { key: string; type: 'int'; value: number }
  | { key: string; type: 'float'; value: number }
  | { key: string; type: 'string'; value: string }
  | { key: string; type: 'blob'; value: Uint8Array }
  /** UTF-16 өрісіне салынған ішкі контейнер (`JointData`) — ашылған күйі. */
  | { key: string; type: 'nested'; value: BzNode }
  | { key: string; type: 'null' }
  /** Delphi TDateTime (1899-12-30-дан бергі тәулік) */
  | { key: string; type: 'datetime'; value: number }

export type BzFile = { header: BzNode; document: BzNode }

/** Сегмент маркері: `01 00 00 FF`, соңынан 1 байт (0 — ашық, 1 — zlib). */
const SEGMENT_MARKER = 0xff000001
/** Кілт индексі 0xFFFFFFFF — атаусыз элемент (тізім/кесте жолы). */
const ANONYMOUS = 0xffffffff

function fail(message: string, allowed?: string): never {
  throw new ConfigValidationError('basis.b3d', message, allowed)
}

class Reader {
  private readonly view: DataView
  pos: number
  constructor(readonly bytes: Uint8Array, pos = 0) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.pos = pos
  }
  private need(n: number): void {
    if (this.pos + n > this.bytes.length) fail(`файл кенет бітті (${this.pos}+${n} > ${this.bytes.length})`)
  }
  u8(): number { this.need(1); return this.bytes[this.pos++]! }
  u32(): number { this.need(4); const v = this.view.getUint32(this.pos, true); this.pos += 4; return v }
  i32(): number { this.need(4); const v = this.view.getInt32(this.pos, true); this.pos += 4; return v }
  f64(): number { this.need(8); const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v }
  raw(n: number): Uint8Array { this.need(n); const v = this.bytes.subarray(this.pos, this.pos + n); this.pos += n; return v }
}

const latin1 = new TextDecoder('latin1')
const utf16 = new TextDecoder('utf-16le', { fatal: true })

function readNames(r: Reader): string[] {
  const count = r.u32()
  if (count > 100_000) fail(`атаулар кестесі тым үлкен: ${count}`)
  const names: string[] = []
  for (let i = 0; i < count; i += 1) names.push(latin1.decode(r.raw(r.u32())))
  return names
}

function startsWithMarker(b: Uint8Array): boolean {
  return b.length >= 5 && b[0] === 0x01 && b[1] === 0 && b[2] === 0 && b[3] === 0xff
}

/** Маркерден кейінгі байттарды ашады (zlib не ашық). */
function segmentPayload(flag: number, rest: Uint8Array): Uint8Array {
  if (flag === 0) return rest
  if (flag !== 1) fail(`белгісіз сегмент жалаушасы ${flag}`, '0 не 1')
  if (rest.length < 2 || rest[0] !== 0x78) fail('zlib тақырыбы жоқ')
  try {
    // fflate raw inflate: 2 байт zlib тақырыбын өткіземіз, adler32 тексерілмейді.
    return inflateSync(rest.subarray(2))
  } catch (e) {
    return fail(`zlib ашылмады: ${(e as Error).message}`)
  }
}

function readNode(r: Reader, names: string[], depth: number): BzNode {
  if (depth > 256) fail('ағаш тым терең')
  const keyIndex = r.u32()
  const count = r.u32()
  const type = r.u8()
  const key = keyIndex === ANONYMOUS ? '' : names[keyIndex] ?? fail(`кілт индексі ${keyIndex} кестеден тыс`)
  switch (type) {
    case 0: {
      const children: BzNode[] = []
      for (let i = 0; i < count; i += 1) children.push(readNode(r, names, depth + 1))
      return { key, type: 'object', children }
    }
    case 1: return { key, type: 'bool', value: true }
    case 2: return { key, type: 'bool', value: false }
    case 3: return { key, type: 'int', value: r.u8() }
    case 4: return { key, type: 'int', value: r.i32() }
    case 5: return { key, type: 'float', value: r.f64() }
    case 6: {
      const bytes = r.raw(r.u32() * 2)
      if (startsWithMarker(bytes)) return { key, type: 'nested', value: readSegment(bytes.subarray(5), bytes[4]!, depth) }
      try {
        return { key, type: 'string', value: utf16.decode(bytes) }
      } catch {
        return { key, type: 'blob', value: bytes }
      }
    }
    case 7: return { key, type: 'blob', value: r.raw(r.u32()) }
    case 8: return { key, type: 'null' }
    case 9: return { key, type: 'datetime', value: r.f64() }
    default: return fail(`белгісіз мән типі ${type} (кілт «${key}», ығысу ${r.pos - 1})`, '0..9')
  }
}

/** Бір сегмент: атаулар кестесі + бір түбір түйін. */
function readSegment(rest: Uint8Array, flag: number, depth = 0): BzNode {
  const payload = segmentPayload(flag, rest)
  const r = new Reader(payload)
  const names = readNames(r)
  const node = readNode(r, names, depth + 1)
  // UTF-16 өрісіне салынған сегмент тақ ұзындықты жұпқа толтырады: ≤ 1 байт қалдық.
  if (payload.length - r.pos > 1) fail(`сегмент соңында ${payload.length - r.pos} артық байт`)
  return node
}

/**
 * Файлды оқиды: `BZ85` + ашық тақырып сегменті (`Header`: нұсқа, PNG
 * миниатюра, `Article`) + zlib-пен сығылған құжат сегменті (`Document`).
 */
export function readBasisContainer(bytes: Uint8Array): BzFile {
  if (bytes.length < 9 || bytes[0] !== 0x42 || bytes[1] !== 0x5a || bytes[2] !== 0x38 || bytes[3] !== 0x35) {
    fail('BZ85 қолтаңбасы жоқ — бұл Базис .b3d/.fr3d файлы емес', 'BZ85')
  }
  const r = new Reader(bytes, 4)
  if (r.u32() !== SEGMENT_MARKER) fail('тақырып сегментінің маркері жоқ')
  if (r.u8() !== 0) fail('тақырып сегменті сығылған — күтілмеген')
  const names = readNames(r)
  const header = readNode(r, names, 0)
  if (r.u32() !== SEGMENT_MARKER) fail('құжат сегментінің маркері жоқ')
  const flag = r.u8()
  const document = readSegment(bytes.subarray(r.pos), flag)
  return { header, document }
}

// ── Көмекші оқығыштар ────────────────────────────────────────────────────────

export function child(node: BzNode | undefined, key: string): BzNode | undefined {
  return node?.type === 'object' ? node.children.find((c) => c.key === key) : undefined
}

export function childrenOf(node: BzNode | undefined, key?: string): BzNode[] {
  if (node?.type !== 'object') return []
  return key === undefined ? node.children : node.children.filter((c) => c.key === key)
}

export function num(node: BzNode | undefined, key: string, fallback = 0): number {
  const c = child(node, key)
  return c && (c.type === 'int' || c.type === 'float') ? c.value : fallback
}

export function str(node: BzNode | undefined, key: string): string | undefined {
  const c = child(node, key)
  return c?.type === 'string' ? c.value : undefined
}

export function blob(node: BzNode | undefined, key: string): Uint8Array | undefined {
  const c = child(node, key)
  return c?.type === 'blob' ? c.value : undefined
}

export function bool(node: BzNode | undefined, key: string): boolean | undefined {
  const c = child(node, key)
  return c?.type === 'bool' ? c.value : undefined
}

// ── Панель контуры (`Contour` блобы) ─────────────────────────────────────────

export type BzContourElement =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  /** `ccw` — басынан соңына сағат тіліне қарсы (1-байт = 1). */
  | { kind: 'arc'; cx: number; cy: number; x1: number; y1: number; x2: number; y2: number; ccw: boolean }
  | { kind: 'circle'; cx: number; cy: number; r: number }

/** u32 саны, әр элемент: тип байты 0x10 (кесінді), 0x11/0x14 (шеңбер), 0x12 (доға). */
export function readContour(bytes: Uint8Array): BzContourElement[] {
  const r = new Reader(bytes)
  const count = r.u32()
  const out: BzContourElement[] = []
  for (let i = 0; i < count; i += 1) {
    const t = r.u8()
    if (t === 0x10) out.push({ kind: 'line', x1: r.f64(), y1: r.f64(), x2: r.f64(), y2: r.f64() })
    // 0x14 — 0x11 сияқты 24 байт (cx, cy, r) шеңбер; айырмасы белгісіз (docs §4.4).
    else if (t === 0x11 || t === 0x14) out.push({ kind: 'circle', cx: r.f64(), cy: r.f64(), r: r.f64() })
    else if (t === 0x12) {
      const [cx, cy, x1, y1, x2, y2] = [r.f64(), r.f64(), r.f64(), r.f64(), r.f64(), r.f64()]
      out.push({ kind: 'arc', cx: cx!, cy: cy!, x1: x1!, y1: y1!, x2: x2!, y2: y2!, ccw: r.u8() === 1 })
    } else fail(`контур элементінің белгісіз типі 0x${t.toString(16)}`, '0x10 | 0x11 | 0x12 | 0x14')
  }
  if (r.pos !== bytes.length) fail(`контур соңында ${bytes.length - r.pos} артық байт`)
  return out
}
