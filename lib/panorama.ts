/** Six real 90° renders → one 2:1 equirectangular panorama. */
import { Camera, PerspectiveCamera, RGBAFormat, Scene, SRGBColorSpace, UnsignedByteType,
  Vector3, Vector4, WebGLRenderTarget, WebGLRenderer } from 'three'

export type CubeFace = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'
export type PanoramaContext = { renderer: WebGLRenderer; scene: Scene; camera: Camera; invalidate: () => void }

const FACE_POSE: Record<CubeFace, { direction: [number, number, number]; up: [number, number, number];
  right: [number, number, number] }> = {
  px: { direction: [1, 0, 0], up: [0, -1, 0], right: [0, 0, -1] },
  nx: { direction: [-1, 0, 0], up: [0, -1, 0], right: [0, 0, 1] },
  py: { direction: [0, 1, 0], up: [0, 0, 1], right: [1, 0, 0] },
  ny: { direction: [0, -1, 0], up: [0, 0, -1], right: [1, 0, 0] },
  pz: { direction: [0, 0, 1], up: [0, -1, 0], right: [1, 0, 0] },
  nz: { direction: [0, 0, -1], up: [0, -1, 0], right: [-1, 0, 0] },
}
const FACE_ORDER: CubeFace[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz']

function faceForDirection(x: number, y: number, z: number): CubeFace {
  const ax = Math.abs(x); const ay = Math.abs(y); const az = Math.abs(z)
  if (ax >= ay && ax >= az) return x >= 0 ? 'px' : 'nx'
  if (ay >= az) return y >= 0 ? 'py' : 'ny'
  return z >= 0 ? 'pz' : 'nz'
}

/** WebGL readRenderTargetPixels rows start at bottom; output image rows start at top. */
export function equirectangularRgba(faces: Readonly<Record<CubeFace, Uint8Array>>, faceSize: number,
  width: number, height: number): Uint8ClampedArray {
  if (!Number.isInteger(faceSize) || faceSize < 1 || !Number.isInteger(width) || width < 1
    || !Number.isInteger(height) || height < 1 || width !== height * 2) {
    throw new Error('Панорама өлшемі 2:1 және оң бүтін сан болуы керек')
  }
  for (const face of FACE_ORDER) {
    if (faces[face].length !== faceSize * faceSize * 4) throw new Error(`Куб бетінің өлшемі қате: ${face}`)
  }
  const output = new Uint8ClampedArray(width * height * 4)
  for (let py = 0; py < height; py += 1) {
    const latitude = Math.PI / 2 - (py + 0.5) / height * Math.PI
    const horizontal = Math.cos(latitude)
    const dy = Math.sin(latitude)
    for (let px = 0; px < width; px += 1) {
      const longitude = ((px + 0.5) / width * 2 - 1) * Math.PI
      const dx = Math.sin(longitude) * horizontal
      const dz = Math.cos(longitude) * horizontal
      const face = faceForDirection(dx, dy, dz)
      const pose = FACE_POSE[face]
      const depth = dx * pose.direction[0] + dy * pose.direction[1] + dz * pose.direction[2]
      const u = (dx * pose.right[0] + dy * pose.right[1] + dz * pose.right[2]) / depth
      const v = (dx * pose.up[0] + dy * pose.up[1] + dz * pose.up[2]) / depth
      const sx = Math.max(0, Math.min(faceSize - 1, Math.floor((u + 1) * 0.5 * faceSize)))
      const sy = Math.max(0, Math.min(faceSize - 1, Math.floor((v + 1) * 0.5 * faceSize)))
      const source = (sy * faceSize + sx) * 4
      output.set(faces[face].subarray(source, source + 4), (py * width + px) * 4)
    }
  }
  return output
}

/** Capture all directions from the current viewpoint, preserving the live renderer's state. */
export function capturePanorama(context: PanoramaContext, faceSize = 512): string {
  const { renderer, scene, camera: sourceCamera } = context
  const target = new WebGLRenderTarget(faceSize, faceSize, {
    format: RGBAFormat, type: UnsignedByteType, depthBuffer: true, stencilBuffer: false,
  })
  target.texture.colorSpace = SRGBColorSpace
  const previousTarget = renderer.getRenderTarget()
  const viewport = renderer.getViewport(new Vector4())
  const scissor = renderer.getScissor(new Vector4())
  const scissorTest = renderer.getScissorTest()
  const autoClear = renderer.autoClear
  const xrEnabled = renderer.xr.enabled
  const camera = new PerspectiveCamera(90, 1, 0.01, 100)
  const position = sourceCamera.getWorldPosition(new Vector3())
  const faces = {} as Record<CubeFace, Uint8Array>
  try {
    renderer.xr.enabled = false
    renderer.autoClear = true
    renderer.setRenderTarget(target)
    renderer.setViewport(0, 0, faceSize, faceSize)
    renderer.setScissorTest(false)
    for (const face of FACE_ORDER) {
      const pose = FACE_POSE[face]
      camera.position.copy(position)
      camera.up.set(...pose.up)
      camera.lookAt(position.x + pose.direction[0], position.y + pose.direction[1],
        position.z + pose.direction[2])
      camera.updateMatrixWorld()
      renderer.clear(true, true, true)
      renderer.render(scene, camera)
      const pixels = new Uint8Array(faceSize * faceSize * 4)
      renderer.readRenderTargetPixels(target, 0, 0, faceSize, faceSize, pixels)
      faces[face] = pixels
    }
    const canvas = document.createElement('canvas')
    canvas.width = faceSize * 4
    canvas.height = faceSize * 2
    const graphics = canvas.getContext('2d')
    if (!graphics) throw new Error('Панорама canvas 2D ашылмады')
    const image = graphics.createImageData(canvas.width, canvas.height)
    image.data.set(equirectangularRgba(faces, faceSize, canvas.width, canvas.height))
    graphics.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    renderer.setRenderTarget(previousTarget)
    renderer.setViewport(viewport)
    renderer.setScissor(scissor)
    renderer.setScissorTest(scissorTest)
    renderer.autoClear = autoClear
    renderer.xr.enabled = xrEnabled
    target.dispose()
    context.invalidate()
  }
}

/** Browser download of the current 360° view; returns the image for preview/tests. */
export function downloadPanorama(context: PanoramaContext): string {
  const url = capturePanorama(context)
  const link = document.createElement('a')
  link.href = url
  link.download = 'panorama-360.png'
  link.click()
  return url
}
