import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

function secret(name) {
  const path = process.env[`${name}_FILE`]
  return path ? readFileSync(path, 'utf8').trim() : process.env[name]
}

const password = secret('POSTGRES_PASSWORD')
if (password && !process.env.DATABASE_URL) {
  const url = new URL('postgresql://postgres@postgres:5432/furniture')
  url.password = password
  process.env.DATABASE_URL = url.toString()
}
for (const name of ['OPENAI_API_KEY', 'SESSION_SECRET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
  const value = secret(name)
  if (value) process.env[name] = value
}

const role = process.argv[2] ?? 'web'
if (!['web', 'api', 'worker'].includes(role)) throw new Error(`Unknown service role: ${role}`)
const command = role === 'worker' ? ['node', '--import', 'tsx', 'scripts/worker.ts'] : ['node', '.next/standalone/server.js']
process.env.HOSTNAME = '0.0.0.0'
const child = spawn(command[0], command.slice(1), { stdio: 'inherit', env: process.env })
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal))
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })
