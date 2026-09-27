/** Dedicated stateless MCP HTTP role. Start with `npm run mcp:serve`. */
import { createServer } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { accountFromMcpAuthorization } from './mcp-auth'
import { createMcpServer } from './mcp-register'

const port = Number(process.env['MCP_PORT'] ?? 3100)
const host = process.env['MCP_HOST'] ?? '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MCP_PORT: 1..65535')

createServer(async (request, response) => {
  if (request.url !== '/mcp') {
    response.writeHead(404).end()
    return
  }
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' }).end()
    return
  }
  const allowedOrigins = (process.env['MCP_ALLOWED_ORIGINS'] ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  const origin = request.headers.origin
  if (origin && !allowedOrigins.includes(origin)) {
    response.writeHead(403).end()
    return
  }
  const account = accountFromMcpAuthorization(request.headers.authorization)
  if (!account) {
    response.writeHead(401, { 'WWW-Authenticate': 'Bearer realm="AisMebel MCP"' }).end()
    return
  }
  const server = createMcpServer(account)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  try {
    await server.connect(transport)
    response.on('close', () => { void transport.close(); void server.close() })
    await transport.handleRequest(request, response)
  } catch (error) {
    if (!response.headersSent) response.writeHead(500).end('MCP transport error')
    process.stderr.write(`MCP transport error: ${error instanceof Error ? error.message : 'unknown'}\n`)
    await transport.close()
    await server.close()
  }
}).listen(port, host, () => {
  process.stdout.write(`AisMebel MCP: http://${host}:${port}/mcp\n`)
})
