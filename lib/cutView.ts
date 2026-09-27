import { playbackFrame } from '@/src/core/cutPlayback'
import type { CutLine } from '@/src/core/cutPlan'

/** A display filter never changes nesting, totals, or exports. */
export function visibleMaterials<T extends { materialId: string }>(
  materials: readonly T[], selected: string,
): readonly T[] {
  return selected === 'all' ? materials : materials.filter((item) => item.materialId === selected)
}

export function cutDisplay(
  cuts: readonly CutLine[], showCuts: boolean, playback: boolean, requestedStep: number,
): { visible: readonly CutLine[]; active: CutLine | null; step: number; total: number } {
  const frame = playbackFrame(cuts, requestedStep)
  return {
    visible: !showCuts ? [] : playback ? [...frame.completed, ...(frame.active ? [frame.active] : [])] : cuts,
    active: showCuts && playback ? frame.active : null,
    step: frame.step,
    total: frame.total,
  }
}
