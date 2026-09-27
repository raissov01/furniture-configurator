import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads'
import { join } from 'node:path'

type Row = Record<string, unknown>
type Result = { rows: Row[]; changes: number }
type Answer = { id: number; ok: true; value: Result } | { id: number; ok: false; error: string }

/** Bridge for the existing synchronous service contract. One worker owns one PG connection. */
export class PostgresCompat {
  private worker!: Worker
  private port!: MessageChannel['port1']
  private state!: Int32Array
  private sequence = 0
  private closed = false

  constructor(private readonly url: string, private readonly schema?: string,
    private readonly timeoutMs = 30_000) {
    this.startWorker()
  }

  private startWorker(): void {
    const root = process.env['PLATFORM_ROOT'] ?? process.cwd()
    const state = new Int32Array(new SharedArrayBuffer(4))
    this.state = state
    this.worker = new Worker(join(root, 'lib/server/pgWorker.cjs'), {
      workerData: { url: this.url, schema: this.schema, migrations: join(root, 'docker/migrations'), state: state.buffer },
    })
    const channel = new MessageChannel()
    this.port = channel.port1
    // These callbacks run between synchronous queries. The shared state also
    // lets a query notice a dropped PG connection while the main thread waits.
    this.worker.on('error', () => { Atomics.store(state, 0, -1) })
    this.worker.on('exit', () => { Atomics.store(state, 0, -1) })
    this.worker.postMessage({ port: channel.port2 }, [channel.port2])
  }

  private restartWorker(): void {
    this.port.close()
    void this.worker.terminate()
    if (!this.closed) this.startWorker()
  }

  private query(sql: string, args: unknown[] = []): Result {
    if (this.closed) throw new Error('PostgreSQL worker closed')
    if (Atomics.load(this.state, 0) < 0) throw new Error('PostgreSQL connection unavailable')
    const id = ++this.sequence
    this.port.postMessage({ id, sql, args })
    const sleeper = new Int32Array(new SharedArrayBuffer(4))
    const deadline = Date.now() + this.timeoutMs
    for (;;) {
      const packet = receiveMessageOnPort(this.port)
      if (packet) {
        const answer = packet.message as Answer
        // A timed-out request can finish after its caller has gone away.
        if (answer.id < id) continue
        if (answer.id !== id) throw new Error('PostgreSQL response order mismatch')
        if (!answer.ok) throw new Error(answer.error)
        return answer.value
      }
      if (Atomics.load(this.state, 0) < 0) throw new Error('PostgreSQL connection unavailable')
      if (Date.now() > deadline) {
        this.restartWorker()
        throw new Error('PostgreSQL worker timed out')
      }
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
    this.closed = true
    this.port.close()
    void this.worker.terminate()
  }
}
