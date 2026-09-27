import { BRIEF_LIMITS } from '@/src/core/brief'

export function briefDimension(raw: string, touched: boolean): { value: number | undefined; error?: string } {
  if (!touched && raw === '') return { value: undefined }
  const value = Number(raw)
  const { min, max } = BRIEF_LIMITS.dimension
  if (!raw.trim() || !/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(value) || value < min || value > max) {
    return { value: undefined, error: `${min}..${max} мм; целое число` }
  }
  return { value }
}

export function currentBriefRequest(startedVersion: number, currentVersion: number): boolean {
  return startedVersion === currentVersion
}

export function formatBriefDimensions(size: { height: number; width: number; depth: number }): string {
  return `${size.height} (H) × ${size.width} (W) × ${size.depth} (D)`
}
