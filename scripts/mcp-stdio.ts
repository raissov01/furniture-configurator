/** Local Claude Desktop companion using the same registered tools and account. */
import { readFileSync } from 'node:fs'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { accountFromMcpAuthorization } from './mcp-auth'
import { createMcpServer } from './mcp-register'

const tokenFile = process.env['MCP_TOKEN_FILE']
if (!tokenFile) throw new Error('MCP_TOKEN_FILE қажет')
const token = readFileSync(tokenFile, 'utf8').trim()
const account = accountFromMcpAuthorization(`Bearer ${token}`)
if (!account) throw new Error('MCP токені жарамсыз немесе мерзімі өткен')
await createMcpServer(account).connect(new StdioServerTransport())
