import { describe, expect, it, vi } from 'vitest'
import { PerspectiveCamera, Scene, Vector4, type WebGLRenderer } from 'three'
import { capturePanorama, equirectangularRgba, type CubeFace } from '../lib/panorama'

const colours: Record<CubeFace, [number, number, number, number]> = {
  px: [255, 0, 0, 255], nx: [0, 255, 0, 255], py: [0, 0, 255, 255],
  ny: [255, 255, 0, 255], pz: [255, 0, 255, 255], nz: [0, 255, 255, 255],
}
const faceSize = 8
const faces = Object.fromEntries(Object.entries(colours).map(([face, rgba]) => [face,
  Uint8Array.from(Array.from({ length: faceSize * faceSize }, () => rgba).flat()),
])) as Record<CubeFace, Uint8Array>

function pixel(data: Uint8ClampedArray, x: number, y: number, width: number): number[] {
  return [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)]
}

describe('алты бағытты нақты panorama проекциясы', () => {
  it('экваторда +Z, +X, -Z, -X және полюсте ±Y бетін алады', () => {
    const width = 360; const height = 180
    const image = equirectangularRgba(faces, faceSize, width, height)
    expect(pixel(image, 180, 90, width)).toEqual(colours.pz)
    expect(pixel(image, 270, 90, width)).toEqual(colours.px)
    expect(pixel(image, 0, 90, width)).toEqual(colours.nz)
    expect(pixel(image, 90, 90, width)).toEqual(colours.nx)
    expect(pixel(image, 180, 0, width)).toEqual(colours.py)
    expect(pixel(image, 180, 179, width)).toEqual(colours.ny)
  })

  it('seam-нің екі шеті бір -Z бағытына түседі және output 2:1', () => {
    const width = 128; const height = 64
    const image = equirectangularRgba(faces, faceSize, width, height)
    expect(image).toHaveLength(width * height * 4)
    expect(pixel(image, 0, 32, width)).toEqual(pixel(image, width - 1, 32, width))
  })

  it('+Z бетіндегі UV сол/оң және үсті/асты пиксельдерді айналдырмай проекциялайды', () => {
    const patterned = { ...faces, pz: new Uint8Array(faceSize * faceSize * 4) }
    for (let y = 0; y < faceSize; y += 1) for (let x = 0; x < faceSize; x += 1) {
      patterned.pz.set([x * 20, y * 20, 7, 255], (y * faceSize + x) * 4)
    }
    const image = equirectangularRgba(patterned, faceSize, 360, 180)
    const left = pixel(image, 160, 90, 360)
    const right = pixel(image, 200, 90, 360)
    const top = pixel(image, 180, 70, 360)
    const bottom = pixel(image, 180, 110, 360)
    expect(left[2]).toBe(7)
    expect(right[2]).toBe(7)
    expect(left[0]).toBeLessThan(right[0]!)
    expect(top[1]).toBeLessThan(bottom[1]!)
  })

  it('алты бөлек render жасап, WebGL күйін және demand кадрын қайтарады', () => {
    let currentTarget: unknown = null
    let currentViewport = new Vector4(4, 5, 600, 400)
    let currentScissor = new Vector4(1, 2, 300, 200)
    let currentScissorTest = true
    const renderer = {
      xr: { enabled: true }, autoClear: false,
      getRenderTarget: () => currentTarget,
      setRenderTarget: (target: unknown) => { currentTarget = target },
      getViewport: (value: Vector4) => value.copy(currentViewport),
      setViewport: (value: Vector4 | number, y?: number, w?: number, h?: number) => {
        currentViewport = value instanceof Vector4 ? value.clone() : new Vector4(value, y, w, h)
      },
      getScissor: (value: Vector4) => value.copy(currentScissor),
      setScissor: (value: Vector4) => { currentScissor = value.clone() },
      getScissorTest: () => currentScissorTest,
      setScissorTest: (value: boolean) => { currentScissorTest = value },
      clear: vi.fn(), render: vi.fn(),
      readRenderTargetPixels: (_target: unknown, _x: number, _y: number, _w: number,
        _h: number, pixels: Uint8Array) => { pixels.fill(128) },
    } as unknown as WebGLRenderer
    const canvas = { width: 0, height: 0,
      getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: vi.fn() }),
      toDataURL: () => 'data:image/png;base64,AAAA' }
    vi.stubGlobal('document', { createElement: () => canvas })
    const invalidate = vi.fn()
    try {
      const png = capturePanorama({ renderer, scene: new Scene(), camera: new PerspectiveCamera(), invalidate }, 4)
      expect(png.startsWith('data:image/png')).toBe(true)
      expect(renderer.render).toHaveBeenCalledTimes(6)
      expect(currentTarget).toBeNull()
      expect(currentViewport.toArray()).toEqual([4, 5, 600, 400])
      expect(currentScissor.toArray()).toEqual([1, 2, 300, 200])
      expect(currentScissorTest).toBe(true)
      expect(renderer.xr.enabled).toBe(true)
      expect(renderer.autoClear).toBe(false)
      expect(invalidate).toHaveBeenCalledOnce()
    } finally { vi.unstubAllGlobals() }
  })
})
