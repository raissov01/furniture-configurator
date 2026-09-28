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
import { FRONT_CAMERA_ORBIT } from '@/lib/arPreview'
import { arPageCopy, arPageLang } from '@/lib/arPageCopy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const lang = arPageLang(new URL(request.url).searchParams.get('lang'))
  const copy = arPageCopy(lang)
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse(copy.notFound, { status: 404 })
  }
  const glb = `/api/ar/${id}`
  const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>${copy.title}</title>
  <script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js"></script>
  <style>
    html,body{margin:0;height:100%;background:#1f2a37;font-family:system-ui,sans-serif;color:#fff}
    model-viewer{width:100vw;height:100vh;--poster-color:#1f2a37}
    .hint{position:fixed;top:14px;left:0;right:0;text-align:center;font-size:14px;color:#fff;pointer-events:none}
    .arbtn{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
      background:#fff;color:#1f2a37;border:1px solid #1f2a37;padding:14px 26px;
      font-size:16px;font-weight:600;cursor:pointer}
    .fail{position:fixed;left:0;right:0;bottom:90px;text-align:center;font-size:14px;color:#fff}
  </style>
</head>
<body>
  <div class="hint">${copy.hint}</div>
  <model-viewer
    src="${glb}"
    alt="${copy.alt}"
    ar
    ar-modes="scene-viewer webxr quick-look"
    ar-placement="floor"
    ar-scale="fixed"
    camera-controls
    camera-orbit="${FRONT_CAMERA_ORBIT}"
    touch-action="pan-y"
    shadow-intensity="1"
    exposure="1.1"
    environment-image="neutral"
    poster-color="#1f2a37">
    <button slot="ar-button" class="arbtn">${copy.action}</button>
    <div class="fail" slot="error">${copy.error}</div>
  </model-viewer>
  <div id="model-error" class="fail" role="alert" hidden>${copy.error}</div>
  <script>document.querySelector('model-viewer').addEventListener('error',function(){document.getElementById('model-error').hidden=false})</script>
</body>
</html>`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
