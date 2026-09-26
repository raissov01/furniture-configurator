/**
 * Платформаның атауы — AisMebel (иесінің шешімі, 2026-09-26).
 *
 * Атау бір жерде тұрады: сайт, metadata, PDF/КП бастамасы, Базис скрипті осыны
 * оқиды. «AisMebel» АУДАРЫЛМАЙДЫ — сөздіктерде де латынша қалады.
 */
export const BRAND = {
  name: 'AisMebel',
  /** Манифест пен тақырыптағы толық атау. */
  fullName: 'AisMebel — мебель цехтарына',
  /** Логотиптің графит түсі — theme_color. */
  color: '#1F2A37',
} as const

/** PDF метадеректері: файл қай бағдарламадан шыққаны көрінсін. */
export function stampPdfBrand(
  doc: { setCreator(v: string): void; setProducer(v: string): void; setTitle?(v: string): void },
  title?: string,
): void {
  doc.setCreator(BRAND.name)
  doc.setProducer(BRAND.name)
  if (title && doc.setTitle) doc.setTitle(title)
}
