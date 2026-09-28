/** Присадка белгілерінің тек экрандағы пішіні; Drill өлшемі өзгермейді. */
export function markerAppearance(diameter: number, xray: boolean, dimmed: boolean): {
  radius: number; depthTest: boolean; opacity: number
} {
  return { radius: Math.max(diameter / 2, xray ? 5 : diameter / 2), depthTest: !xray,
    opacity: dimmed ? 0.65 : 1 }
}
