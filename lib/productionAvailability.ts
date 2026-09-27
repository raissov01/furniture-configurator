/** Preview may keep its last valid scene; manufacturing always needs valid current input. */
export function productionAvailability(error: string | null, draftInvalid: boolean):
  { cutListAvailable: boolean; exportsAvailable: boolean } {
  const available = !error && !draftInvalid
  return { cutListAvailable: available, exportsAvailable: available }
}
