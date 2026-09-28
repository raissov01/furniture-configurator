/**
 * PRO100-дегі «Свет» терезесінің деректері (таза функциялар, React/three.js-сіз).
 *
 * PRO100 ағашы: «эффекты» (сглаживание, блики, рельеф, глобальное затенение,
 * отражение) және «свет» (общее → камера, солнце). Әр жолда құсбелгі мен
 * 0…100 жүгірткісі бар. Бұл — адамның көрініс баптауы (тема сияқты), жоба
 * файлына кірмейді: сахнаның есебіне, раскройға, бағаға әсері жоқ.
 */

export type LightingKey = 'antialias' | 'highlights' | 'relief' | 'ao' | 'reflection' | 'general' | 'camera' | 'sun'
export type LightingChannel = { on: boolean; value: number }
export type ClassicLighting = Record<LightingKey, LightingChannel>

/** Эталон видеодағы бастапқы жүгірткілер орны (шамамен), 0…100. */
export const DEFAULT_LIGHTING: ClassicLighting = {
  antialias: { on: true, value: 100 },
  highlights: { on: true, value: 100 },
  relief: { on: true, value: 100 },
  ao: { on: true, value: 100 },
  reflection: { on: true, value: 60 },
  general: { on: true, value: 100 },
  camera: { on: true, value: 35 },
  sun: { on: true, value: 80 },
}

/** Ағаштағы тәртіп пен орысша кілт-атаулар (`t()` аударады). */
export const LIGHTING_TREE: { group: 'effects' | 'light'; label: string; rows: { key: LightingKey; label: string; depth: number }[] }[] = [
  { group: 'effects', label: 'эффекты', rows: [
    { key: 'antialias', label: 'сглаживание', depth: 1 },
    { key: 'highlights', label: 'блики', depth: 1 },
    { key: 'relief', label: 'рельеф', depth: 1 },
    { key: 'ao', label: 'глобальное затенение', depth: 1 },
    { key: 'reflection', label: 'отражение', depth: 1 },
  ] },
  { group: 'light', label: 'свет', rows: [
    { key: 'general', label: 'общее', depth: 1 },
    { key: 'camera', label: 'камера', depth: 2 },
    { key: 'sun', label: 'солнце', depth: 2 },
  ] },
]

const KEYS = Object.keys(DEFAULT_LIGHTING) as LightingKey[]

/** Сақталған JSON-ды қатаң оқу: бұзылған не ескі жазба әдепкіге құлайды. */
export function parseLighting(raw: string | null): ClassicLighting {
  if (!raw) return DEFAULT_LIGHTING
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return DEFAULT_LIGHTING
    const out = { ...DEFAULT_LIGHTING }
    for (const key of KEYS) {
      const entry = (value as Record<string, unknown>)[key]
      if (typeof entry !== 'object' || entry === null) continue
      const on = (entry as { on?: unknown }).on
      const number = (entry as { value?: unknown }).value
      if (typeof on === 'boolean' && typeof number === 'number' && Number.isFinite(number)) {
        out[key] = { on, value: clampPercent(number) }
      }
    }
    return out
  } catch {
    return DEFAULT_LIGHTING
  }
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** Арнаның 0…1 үлесі; құсбелгі алынса — 0. */
export function lightingFactor(lighting: ClassicLighting, key: LightingKey): number {
  const channel = lighting[key]
  return channel.on ? channel.value / 100 : 0
}

/**
 * «Общее» — ата жол: ол өшсе, камера мен күн де өшеді (PRO100 ағашындағыдай).
 * Қайтарылатын сандар — three.js жарық қарқындылығы.
 */
export function sceneLightIntensities(lighting: ClassicLighting): {
  ambient: number; hemisphere: number; sun: number; camera: number; environment: number; ao: number
} {
  const general = lightingFactor(lighting, 'general')
  return {
    ambient: 0.08 + 0.32 * general,
    hemisphere: 0.22 * general,
    sun: 1.5 * general * lightingFactor(lighting, 'sun') / 0.8,
    camera: 0.9 * general * lightingFactor(lighting, 'camera'),
    environment: 0.55 * lightingFactor(lighting, 'highlights') * (0.4 + lightingFactor(lighting, 'reflection')),
    ao: 2.2 * lightingFactor(lighting, 'ao'),
  }
}
