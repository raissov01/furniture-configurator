import { describe, expect, it } from 'vitest'
import { activeCloudProjectId, parseCloudProjectBinding } from '@/lib/cloudProjectBinding'

describe('F27 бирка жобасының ID-і', () => {
  it('тек сақталған дәл осы жобаға QR береді', () => {
    const binding = parseCloudProjectBinding('{"id":"cloud-42","fingerprint":"abc"}')
    expect(activeCloudProjectId('abc', binding)).toBe('cloud-42')
    expect(activeCloudProjectId('changed', binding)).toBeNull()
    expect(activeCloudProjectId('abc', null)).toBeNull()
  })
  it('бүлінген сақталған байланыс ID-ін қолданбайды', () => {
    expect(parseCloudProjectBinding('{"id":"","fingerprint":"abc"}')).toBeNull()
    expect(parseCloudProjectBinding('bad')).toBeNull()
  })
})
