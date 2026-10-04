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

 it('verifies every pushed branch without enabling automatic publication or deployment', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/platform.yml'), 'utf8')
    const push = workflow.match(/\n  push:\n([\s\S]*?)(?=\n  \w+:)/)?.[1] ?? ''
    expect(push).toContain("branches: ['**']")
    const deploy = workflow.match(/\n  deploy:\n([\s\S]*?)(?=\n  [a-z][a-z-]*:\n|$)/)?.[1]
    expect(deploy).toContain("github.event_name == 'workflow_dispatch'")
    expect(deploy).toContain("github.ref == 'refs/heads/main'")
  })
