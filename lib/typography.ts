/** Keep a grammatical em dash from becoming the first glyph on a new line. */
export function keepDashWithPreviousWord(text: string): string {
  return text.replace(/ — /g, '\u00a0— ')
}
