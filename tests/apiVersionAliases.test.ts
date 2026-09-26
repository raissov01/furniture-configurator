import { describe, expect, it } from 'vitest'
import * as oldProjects from '../app/api/projects/route'
import * as v1Projects from '../app/api/v1/projects/route'
import * as oldApproval from '../app/api/share/[code]/approval/route'
import * as v1Approval from '../app/api/v1/share/[code]/approval/route'

describe('API v1 aliases', () => {
  it('uses the same handlers as existing routes', () => {
    expect(typeof v1Projects.GET).toBe('function')
    expect(typeof v1Projects.POST).toBe('function')
    expect(typeof v1Approval.GET).toBe('function')
    expect(typeof v1Approval.POST).toBe('function')
    expect(typeof v1Approval.PUT).toBe('function')
    expect(v1Projects.GET).not.toBe(oldProjects.GET)
    expect(v1Approval.PUT).not.toBe(oldApproval.PUT)
  })
})
