import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApprovalBannerContent } from '../components/ApprovalBanner'

describe('цехтағы келісім белгісі', () => {
  it('жоба өзгерген соң да клиент мақұлдаған бұрынғы PDF нұсқасына сілтейді', () => {
    const html = renderToStaticMarkup(createElement(ApprovalBannerContent, { code: '123456', info: {
      version: 2, status: 'pending', latestApprovedVersion: 1,
    } }))
    expect(html).toContain('Клиент согласовал версию')
    expect(html).toContain('Текущий проект изменён после согласования')
    expect(html).toContain('/api/share/123456/approval?version=1&amp;format=pdf')
  })
})
