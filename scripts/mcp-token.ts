/** Issue an existing 30-day account session for MCP; password comes from stdin. */
import { readFileSync } from 'node:fs'
import { endSession, login } from '../lib/server/auth'

const email = process.argv[2]
if (email === '--revoke') {
  const path = process.argv[3]
  if (!path) throw new Error('Қолданыс: npm run mcp:token -- --revoke /path/to/token-file')
  endSession(readFileSync(path, 'utf8').trim())
  process.stdout.write('MCP токені қайтарылды\n')
  process.exit(0)
}
if (!email) throw new Error('Қолданыс: npm run mcp:token -- email@example.kz < password')
let password = ''
for await (const chunk of process.stdin) {
  password += String(chunk)
  if (password.length > 1024) throw new Error('Құпиясөз тым ұзын')
}
const result = login(email, password.replace(/[\r\n]+$/, ''))
if (!result.ok) {
  process.stderr.write(`${result.error}\n`)
  process.exitCode = 1
} else if (result.account.role !== 'owner' && result.account.role !== 'designer') {
  endSession(result.token)
  process.stderr.write('MCP үшін owner не designer рөлі керек\n')
  process.exitCode = 1
} else {
  process.stdout.write(`${result.token}\n`)
}
