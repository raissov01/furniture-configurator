/**
 * АДАМНЫҢ СИЛУЭТІ — масштабтың өлшемі.
 *
 * НЕГЕ КЕРЕК. Экрандағы шкафтың 3D-дегі көрінісі өлшемсіз: 1800 мм биік
 * шкаф та, 2400 мм биігі де бірдей көрінеді, себебі камера оны кадрға
 * сыйдырады. Клиент «биіктігі 2400» дегенді санмен ұғады, ал жанында адам
 * тұрса — БІРДЕН көреді. Цехта бұл нақты пайда береді: жоғарғы сөреге қол
 * жете ме, антресольге тұрып алу керек пе — соны келіспей тұрып шешеді.
 *
 * ⚠ БҰЛ — СЫЗБА ЕМЕС. Силуэт деталировкаға да, раскройға да, сметаға да
 * КІРМЕЙДІ: ол тек көрініс. Сондықтан ол `Panel` емес, жай ғана сурет.
 *
 * Пропорциялар — Витрувий адамының қарапайым ережесі: бой = 7,5 бас.
 * Дәлдіктің қажеті жоқ, керегі — көзге таныс адам пішіні.
 */

/** Әдепкі бой, мм — ересек адамның орташасы. */
export const DEFAULT_SILHOUETTE_HEIGHT = 1700
export const MIN_SILHOUETTE_HEIGHT = 1000
export const MAX_SILHOUETTE_HEIGHT = 2200

/** Силуэттің ені бойға қатысты: иықтың кеңдігі ≈ бойдың 0,26-ы. */
export const SILHOUETTE_ASPECT = 0.26

/**
 * Силуэттің SVG-і. `heightMm` — бой; сурет сол биіктікке қарай масштабталады,
 * сондықтан оны 3D-де де, қағаздағы сызбада да бірдей қолдануға болады.
 *
 * Жол (path) БІР ТҰТАС: басы, денесі, қолы мен аяғы — бір контур. Осылай
 * ол кез келген фонда, кез келген өлшемде таза шығады.
 */
export function silhouetteSvg(heightMm = DEFAULT_SILHOUETTE_HEIGHT, color = '#1f2933'): string {
  const w = Math.round(heightMm * SILHOUETTE_ASPECT)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 384" width="${w}" height="${Math.round(heightMm)}">`,
    `<path fill="${color}" d="`,
    // Басы: дөңгелек (бойдың 1/7,5-і).
    'M50 8c-12 0-21 9-21 21s9 21 21 21 21-9 21-21S62 8 50 8z',
    // Мойын мен иық, қолдары денеге жақын түсіп тұр.
    'M50 54c-15 0-26 8-29 21l-9 46c-1 6 2 11 8 12s11-3 12-9l6-30 2 44',
    // Сол аяқ.
    'l-9 76c-1 7 4 13 11 13s12-5 13-12l5-56 5 56c1 7 6 12 13 12s12-6 11-13',
    // Оң аяқ пен қайта жоғары.
    'l-9-76 2-44 6 30c1 6 6 10 12 9s9-6 8-12l-9-46c-3-13-14-21-29-21z',
    '"/></svg>',
  ].join('')
}

/** Браузерге де, PDF-ке де жарайтын data-URI. */
export function silhouetteDataUri(heightMm?: number, color?: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(silhouetteSvg(heightMm, color))}`
}

/** Силуэттің 3D-дегі жазықтығының өлшемі, метрмен (three.js метрмен жүреді). */
export function silhouetteSize(heightMm: number): { width: number; height: number } {
  return { width: (heightMm * SILHOUETTE_ASPECT) / 1000, height: heightMm / 1000 }
}
