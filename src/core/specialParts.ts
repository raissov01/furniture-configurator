/** Арнайы өндірістік бөлшектер. Бұл модуль React/three импорттамайды. */
import { ConfigValidationError } from './errors'

export type LathePoint = { radius: number; y: number }
export type LatheSpec = { kind: 'lathe'; profile: LathePoint[]; materialId: string;
  quantity: number; unitPrice: number }
export type BentSpec = { kind: 'bent'; chord: number; radius?: number | undefined;
  angleDegrees?: number | undefined; height: number; thickness: number;
  referenceFace: 'inner' | 'outer'; materialId: string; quantity: number; unitPrice: number }
export type FabricationSpec = LatheSpec | BentSpec

export const LATHE_PROFILES: readonly { id: string; name: string; profile: LathePoint[] }[] = [
  { id: 'straight-leg', name: 'Прямая ножка', profile: [{ radius: 20, y: 0 }, { radius: 20, y: 420 }] },
  { id: 'tapered-leg', name: 'Коническая ножка', profile: [{ radius: 36, y: 0 }, { radius: 26, y: 420 }] },
  { id: 'baluster', name: 'Балясина', profile: [{ radius: 22, y: 0 }, { radius: 32, y: 40 }, { radius: 20, y: 120 }, { radius: 40, y: 240 }, { radius: 20, y: 360 }, { radius: 30, y: 420 }] },
  { id: 'column', name: 'Колонна', profile: [{ radius: 40, y: 0 }, { radius: 40, y: 40 }, { radius: 30, y: 50 }, { radius: 30, y: 370 }, { radius: 40, y: 380 }, { radius: 40, y: 420 }] },
  { id: 'knob', name: 'Ручка-кнопка', profile: [{ radius: 12, y: 0 }, { radius: 12, y: 10 }, { radius: 20, y: 20 }, { radius: 20, y: 30 }] },
  { id: 'turned-handle', name: 'Точёная ручка', profile: [{ radius: 12, y: 0 }, { radius: 18, y: 15 }, { radius: 12, y: 35 }, { radius: 18, y: 55 }, { radius: 12, y: 70 }] },
]

function fail(field: string, message: string, allowed: string): never {
  throw new ConfigValidationError(field, message, allowed)
}
function positiveMm(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) fail(field, 'бүтін оң мм қажет', '1..MAX_SAFE_INTEGER мм')
}
function nonnegativeMm(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) fail(field, 'бүтін мм қажет', '0..MAX_SAFE_INTEGER мм')
}
function minorUnits(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) fail(field, 'бүтін тиын қажет', '0..MAX_SAFE_INTEGER тиын')
}
function common(spec: FabricationSpec): void {
  if (!spec.materialId.trim()) fail('materialId', 'материал жоқ', 'каталогтағы материал id')
  positiveMm(spec.quantity, 'quantity')
  minorUnits(spec.unitPrice, 'unitPrice')
}

export function validateLathe(spec: LatheSpec): { height: number; maxDiameter: number } {
  common(spec)
  if (spec.profile.length < 2 || spec.profile.length > 128 || spec.profile[0]?.y !== 0) {
    fail('profile', 'профиль басы 0 мм және кемі екі нүкте болуы керек', '2..128 нүкте, алғашқы y=0')
  }
  let last = -1
  let maxRadius = 0
  for (const point of spec.profile) {
    nonnegativeMm(point.radius, 'profile.radius')
    nonnegativeMm(point.y, 'profile.y')
    if (point.y < last) fail('profile.y', 'биіктік реті теріс', 'өспелі y')
    last = point.y
    maxRadius = Math.max(maxRadius, point.radius)
  }
  if (last < 1 || maxRadius < 1) fail('profile', 'биіктік пен радиус оң болуы керек', 'height, radius > 0')
  if (!Number.isSafeInteger(maxRadius * 2)) fail('profile.radius', 'диаметр ауқымнан асты', 'қауіпсіз бүтін мм')
  return { height: last, maxDiameter: maxRadius * 2 }
}

export type BentDevelopment = { radius: number; innerRadius: number; outerRadius: number;
  angleDegrees: number; angleRadians: number; developedLength: number; height: number; chord: number;
  spanWidth: number; depth: number }

/** R — таңдалған ішкі не сыртқы бет радиусы. Развёртка R·θ, дәл .5 мм жоғары. */
export function bentDevelopment(spec: BentSpec, minBendRadiusMm: number | undefined): BentDevelopment {
  common(spec)
  positiveMm(spec.chord, 'chord')
  positiveMm(spec.height, 'height')
  positiveMm(spec.thickness, 'thickness')
  if (minBendRadiusMm === undefined) fail('minBendRadiusMm', 'цехтың ең аз иілу радиусы жоқ', 'материал баптауында оң бүтін мм')
  positiveMm(minBendRadiusMm, 'minBendRadiusMm')
  if ((spec.radius === undefined) === (spec.angleDegrees === undefined)) {
    fail('radius', 'радиус не бұрыштың тек бірі беріледі', 'radius XOR angleDegrees')
  }
  if (spec.angleDegrees !== undefined &&
      (!Number.isFinite(spec.angleDegrees) || spec.angleDegrees <= 0 || spec.angleDegrees > 180)) {
    fail('angleDegrees', 'бұрыш жарамсыз', '0..180°')
  }
  const radius = spec.radius ?? Math.round(spec.chord / (2 * Math.sin(spec.angleDegrees! * Math.PI / 360)))
  positiveMm(radius, 'radius')
  if (spec.chord > 2 * radius) fail('chord', 'хорда диаметрден үлкен', `1..${2 * radius} мм`)
  const innerRadius = spec.referenceFace === 'inner' ? radius : radius - spec.thickness
  const outerRadius = spec.referenceFace === 'outer' ? radius : radius + spec.thickness
  if (innerRadius < minBendRadiusMm) fail('radius', 'материалдың ең аз иілу радиусынан кіші', `≥ ${minBendRadiusMm + (spec.referenceFace === 'outer' ? spec.thickness : 0)} мм`)
  const angle = 2 * Math.asin(spec.chord / (2 * radius))
  const developedLength = Math.round(radius * angle)
  if (!Number.isSafeInteger(developedLength) || developedLength < 1) fail('developedLength', 'развёртка жарамсыз', 'оң бүтін мм')
  const spanWidth = Math.ceil(2 * outerRadius * Math.sin(angle / 2))
  const depth = Math.ceil(outerRadius - innerRadius * Math.cos(angle / 2))
  if (![spanWidth, depth].every((value) => Number.isSafeInteger(value) && value > 0)) {
    fail('size', 'иілген бөлшек ауқымнан асты', 'қауіпсіз бүтін мм')
  }
  return { radius, innerRadius, outerRadius, angleDegrees: Math.round(angle * 180_000 / Math.PI) / 1000,
    angleRadians: angle,
    developedLength, height: spec.height, chord: spec.chord, spanWidth, depth }
}

export function specialSolidSize(spec: FabricationSpec, minBendRadiusMm: number | undefined): { x: number; y: number; z: number } {
  if (spec.kind === 'lathe') {
    const { height, maxDiameter } = validateLathe(spec)
    return { x: maxDiameter, y: height, z: maxDiameter }
  }
  const { spanWidth, height, depth } = bentDevelopment(spec, minBendRadiusMm)
  return { x: spanWidth, y: height, z: depth }
}

export type SpecialPartRow = { nodeId: string; section: 'Токарлық бұйым' | 'Иілген деталь'; name: string;
  materialId: string; materialName: string; quantity: number; height: number;
  maxDiameter?: number | undefined; developedLength?: number | undefined;
  radius?: number | undefined; angleDegrees?: number | undefined;
  operation: 'токарлық операция' | 'жеке иілу операциясы'; unitPrice: number }

/** Тек көрінетін flatScene.solids-тан шақырылады. Панельдер бұған кірмейді. */
export function specialPartRows(
  parts: readonly { nodeId: string; name: string; spec: FabricationSpec }[],
  materials: ReadonlyMap<string, { name: string; minBendRadiusMm?: number | undefined }>,
): SpecialPartRow[] {
  return parts.map(({ nodeId, name, spec }) => {
    const material = materials.get(spec.materialId)
    if (!material) fail('materialId', `материал ${spec.materialId} табылмады`, 'каталогтағы материал id')
    if (spec.kind === 'lathe') {
      const size = validateLathe(spec)
      return { nodeId, section: 'Токарлық бұйым', name, materialId: spec.materialId,
        materialName: material.name, quantity: spec.quantity, ...size,
        operation: 'токарлық операция', unitPrice: spec.unitPrice }
    }
    const size = bentDevelopment(spec, material.minBendRadiusMm)
    return { nodeId, section: 'Иілген деталь', name, materialId: spec.materialId,
      materialName: material.name, quantity: spec.quantity, height: size.height,
      developedLength: size.developedLength, radius: size.radius,
      angleDegrees: size.angleDegrees, operation: 'жеке иілу операциясы', unitPrice: spec.unitPrice }
  })
}

export function specialPartsPrice(rows: readonly SpecialPartRow[]): {
  total: number; lines: { nodeId: string; name: string; quantity: number; unitPrice: number; cost: number }[]
} {
  const lines = rows.map((row) => {
    positiveMm(row.quantity, 'specialParts.quantity')
    minorUnits(row.unitPrice, 'specialParts.unitPrice')
    const cost = row.quantity * row.unitPrice
    if (!Number.isSafeInteger(cost)) fail('unitPrice', 'сома ауқымнан асты', 'қауіпсіз бүтін тиын')
    return { nodeId: row.nodeId, name: row.name, quantity: row.quantity, unitPrice: row.unitPrice, cost }
  })
  const total = lines.reduce((sum, line) => sum + line.cost, 0)
  if (!Number.isSafeInteger(total)) fail('unitPrice', 'жалпы сома ауқымнан асты', 'қауіпсіз бүтін тиын')
  return { total, lines }
}

/** Иілген детальге бөлек, бұрғысыз DXF: развёртка × биіктік. */
export function bentDxf(developedLength: number, height: number): string {
  positiveMm(developedLength, 'developedLength')
  positiveMm(height, 'height')
  return ['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC',
    '0','SECTION','2','ENTITIES','0','LWPOLYLINE','8','BENT_DEVELOPMENT','90','4','70','1',
    '10','0','20','0','10',String(developedLength),'20','0',
    '10',String(developedLength),'20',String(height),'10','0','20',String(height),
    '0','ENDSEC','0','EOF',''].join('\n')
}
