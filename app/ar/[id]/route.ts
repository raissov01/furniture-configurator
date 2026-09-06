/**
 * AR КӨРУ БЕТІ (телефонға арналған).
 *
 * Бұрын сілтеме шикі `.glb` файлын беретін де, телефон оны тек 3D болып
 * көрсететін — БӨЛМЕГЕ қоймайтын. Енді сілтеме осы БЕТКЕ келеді: мұнда
 * `<model-viewer>` тұр, ол Android-та Scene Viewer (ARCore) арқылы жиһазды
 * КАМЕРАМЕН еденге қояды, iOS-та Quick Look-ты (USDZ болса) шақырады.
 *
 * ⚠ Бұл — Artifact емес, өз Next қосымшамыз: CDN-нен скрипт жүктеуге болады.
 * model-viewer нақты нұсқаға бекітілген.
 */

import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse('Не найдено', { status: 404 })
  }
  const glb = `/api/ar/${id}`
  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Мебель в вашей комнате — AR</title>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js"></script>
  <style>
    html,body{margin:0;height:100%;background:#0f1216;font-family:system-ui,sans-serif;color:#e8eaed}
    model-viewer{width:100vw;height:100vh;--poster-color:#0f1216}
    .hint{position:fixed;top:14px;left:0;right:0;text-align:center;font-size:14px;color:#c8ccd2;pointer-events:none}
    .arbtn{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
      background:#fff;color:#111;border:none;border-radius:999px;padding:14px 26px;
      font-size:16px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer}
    .fail{position:fixed;left:0;right:0;bottom:90px;text-align:center;font-size:13px;color:#9aa0a6}
  </style>
</head>
<body>
  <div class="hint">Наведите камеру на пол и поставьте мебель в комнате</div>
  <model-viewer
    src="${glb}"
    alt="Мебель"
    ar
    ar-modes="scene-viewer webxr quick-look"
    ar-placement="floor"
    ar-scale="fixed"
    camera-controls
    touch-action="pan-y"
    shadow-intensity="1"
    exposure="1.1"
    environment-image="neutral"
    poster-color="#0f1216">
    <button slot="ar-button" class="arbtn">📷 Смотреть в комнате</button>
    <div class="fail" slot="error">Не удалось загрузить модель</div>
  </model-viewer>
</body>
</html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
