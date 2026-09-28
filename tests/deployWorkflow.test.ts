import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('platform image publication', () => {
  it('requires a manual workflow dispatch before publishing an image', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/platform.yml'), 'utf8')
    const imageJob = workflow.match(/\n  image:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:\n|$)/)?.[1]
    expect(imageJob).toBeDefined()
    expect(imageJob).toMatch(/^    if: .*github\.event_name == 'workflow_dispatch'$/m)
  })
})
