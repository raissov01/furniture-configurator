/**
 * AR: жиһазды ТЕЛЕФОННЫҢ КАМЕРАСЫ арқылы бөлмеге қою.
 *
 * ҚАЛАЙ ЖҰМЫС ІСТЕЙДІ. Тірі 3D сахна GLB файлына айналады, сервер оны
 * уақытша сақтайды, ал телефон сол сілтемені Google Scene Viewer-де ашады.
 * Scene Viewer — Android-тың ӨЗ AR көрсеткіші: қосымша орнатудың қажеті жоқ.
 *
 * ⚠ iPhone-да AR ҚАЗІРГЕ ЖОҚ, әрі бұл әдейі айтылады. Apple-дің Quick Look-ы
 * USDZ форматын талап етеді, ал оны браузерде жасау мүмкін емес (Apple-дің өз
 * құралы керек). «Жарты-жарым AR» көрсетіп, iPhone-да үнсіз сынғаннан гөрі,
 * «телефонда Android керек» деп ашық жазған адал.
 */

export type ArUpload = { url: string; expiresAt: number }

/** Сахнаны GLB-ге айналдыру. Экспорттаушы АУЫР, сондықтан басқанда жүктеледі. */
export async function sceneToGlb(scene: object): Promise<Uint8Array> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene as never, {
    binary: true,
    // Тор мен өлшем сызықтары AR-ға керек емес: клиент ЖИҺАЗДЫ көреді.
    onlyVisible: true,
  })
  return new Uint8Array(result as ArrayBuffer)
}

/**
 * Scene Viewer сілтемесі.
 *
 * `mode=ar_preferred` — телефон AR-ды көтермесе, кәдімгі 3D көрсеткіш
 * ашылады: батырма «жұмыс істемеді» болып қалмауы керек.
 */
export function sceneViewerUrl(fileUrl: string, title: string): string {
  const params = new URLSearchParams({
    file: fileUrl,
    mode: 'ar_preferred',
    title,
    // Жиһаз ЕДЕНГЕ қойылады, қабырғаға емес.
    resizable: 'false',
  })
  return `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}`
    + '#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;'
    + `S.browser_fallback_url=${encodeURIComponent(fileUrl)};end;`
}

/** Телефон Android па (Scene Viewer тек сонда). */
export function isAndroid(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /android/i.test(ua)
}

export function isIos(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(ua)
}
