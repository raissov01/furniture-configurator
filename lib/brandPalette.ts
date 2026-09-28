/** WCAG 2.x салыстырмалы жарықтық бойынша екі алты таңбалы HEX түстің контрасты. */
export function hexContrast(first: string, second: string): number {
  const luminance = (hex: string): number => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Түс: #RRGGBB пішімі қажет')
    const channels = [1, 3, 5].map((index) => {
      const channel = parseInt(hex.slice(index, index + 2), 16) / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  }
  const lighter = Math.max(luminance(first), luminance(second))
  const darker = Math.min(luminance(first), luminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}
