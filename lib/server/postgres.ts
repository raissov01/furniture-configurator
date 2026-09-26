import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads'
import { join } from 'node:path'

type Row = Record<string, unknown>
type Result = { rows: Row[]; changes: number }
type Answer = { id: number; ok: true; value: Result } | { id: number; ok: false; error: string }

/** Bridge for the existing synchronous service contract. One worker owns one PG connection. */
export class PostgresCompat {
  private readonly worker: Worker
  private readonly port: MessageChannel['port1']
  private sequence = 0

  constructor(url: string, schema?: string) {
    const root = process.env['PLATFORM_ROOT'] ?? process.cwd()
    this.worker = new Worker(join(root, 'lib/server/pgWorker.cjs'), {
      workerData: { url, schema, migrations: join(root, 'docker/migrations') },
    })
    const channel = new MessageChannel()
    this.port = channel.port1
    this.worker.postMessage({ port: channel.port2 }, [channel.port2])
  }

  private query(sql: string, args: unknown[] = []): Result {
    const id = ++this.sequence
    this.port.postMessage({ id, sql, args })
    const sleeper = new Int32Array(new SharedArrayBuffer(4))
    const deadline = Date.now() + 30_000
    for (;;) {
      const packet = receiveMessageOnPort(this.port)
      if (packet) {
        const answer = packet.message as Answer
        if (answer.id !== id) throw new Error('PostgreSQL response order mismatch')
        if (!answer.ok) throw new Error(answer.error)
        return answer.value
      }
      if (Date.now() > deadline) throw new Error('PostgreSQL worker timed out')
      Atomics.wait(sleeper, 0, 0, 5)
    }
  }

  exec(sql: string): void { this.query(sql) }

  prepare(sql: string): { get: (...args: unknown[]) => Row | undefined; all: (...args: unknown[]) => Row[]; run: (...args: unknown[]) => { changes: number; lastInsertRowid: number } } {
    return {
      get: (...args) => this.query(sql, args).rows[0],
      all: (...args) => this.query(sql, args).rows,
      run: (...args) => ({ changes: this.query(sql, args).changes, lastInsertRowid: 0 }),
    }
  }

  close(): void {
    this.port.close()
    void this.worker.terminate()
  }
}
