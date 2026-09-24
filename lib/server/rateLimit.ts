import { createHash } from 'node:crypto'
import { db } from './db'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/** Тек сенімді reverse proxy берген IP; шеткі proxy осы тақырыптарды қайта жазуы тиіс. */
export function requestIp(request: Request): string {
  const ip = request.headers.get('x-real-ip') ?? 'unknown'
  return ip.split(',')[0]!.trim().slice(0, 64)
}

function subject(ip: string, code?: string): string {
  return createHash('sha256').update(code ? `${ip}\0${code}` : ip).digest('hex')
}

/** SQLite бір VPS-та ортақ. BEGIN IMMEDIATE есептегіш жарысын болдырмайды. */
function consume(bucket: string, identity: string, duration: number, maximum: number, now: number): boolean {
  const database = db()
  const start = Math.floor(now / duration) * duration
  database.exec('BEGIN IMMEDIATE')
  try {
    database.prepare('DELETE FROM request_limits WHERE window_start < ?').run(now - HOUR)
    const row = database.prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
      .get(bucket, identity, start) as { attempts: number } | undefined
    if ((row?.attempts ?? 0) >= maximum) {
      database.exec('COMMIT')
      return false
    }
    database.prepare(`INSERT INTO request_limits (bucket, subject, window_start, attempts) VALUES (?, ?, ?, 1)
      ON CONFLICT(bucket, subject, window_start) DO UPDATE SET attempts = attempts + 1`).run(bucket, identity, start)
    database.exec('COMMIT')
    return true
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

/** Бір IP-ден 20 қате/сағат және бір кодқа 5 қате/сағат. */
export function allowShareMiss(ip: string, code: string, now = Date.now()): boolean {
  if (!consume('share-ip', subject(ip), HOUR, 20, now)) return false
  return consume('share-code', subject(ip, code), HOUR, 5, now)
}

export function isShareLimited(ip: string, code: string, now = Date.now()): boolean {
  const database = db()
  const start = Math.floor(now / HOUR) * HOUR
  const count = (bucket: string, identity: string): number => {
    const row = database.prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
      .get(bucket, identity, start) as { attempts: number } | undefined
    return row?.attempts ?? 0
  }
  return count('share-ip', subject(ip)) >= 20 || count('share-code', subject(ip, code)) >= 5
}

/** Бір IP бір share-ге минутына ең көбі бес пікір жазады. */
export function allowComment(ip: string, code: string, now = Date.now()): boolean {
  return consume('comment', subject(ip, code), MINUTE, 5, now)
}
