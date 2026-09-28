import { createHash } from 'node:crypto'
import { db } from './db'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const MINUTE = 60 * 1000

/** Тек сенімді reverse proxy берген IP; шеткі proxy осы тақырыптарды қайта жазуы тиіс. */
export function requestIp(request: Request): string {
  const ip = request.headers.get('x-real-ip') ?? 'unknown'
  return ip.split(',')[0]!.trim().slice(0, 64) || 'unknown'
}

// Proxy мекенжайын ала алмасақ, барлық белгісіз клиент ортақ қатаң шекке түседі.
const shareIpMaximum = (ip: string): number => ip === 'unknown' ? 5 : 20

function subject(ip: string, code?: string): string {
  return createHash('sha256').update(code ? `${ip}\0${code}` : ip).digest('hex')
}

const LOGIN_IP_MISSES = 20
const LOGIN_ACCOUNT_MISSES = 5

/** Бір сағатта IP бойынша 20, email бойынша 5 қате кіруден кейін scrypt-ке өтпейміз. */
export function isLoginLimited(ip: string, email: string, now = Date.now()): boolean {
  const start = Math.floor(now / HOUR) * HOUR
  const database = db()
  const count = (bucket: string, identity: string): number => {
    const row = database.prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
      .get(bucket, identity, start) as { attempts: number } | undefined
    return row?.attempts ?? 0
  }
  return count('login-ip', subject(ip)) >= (ip === 'unknown' ? 5 : LOGIN_IP_MISSES)
    || count('login-account', subject(email.trim().toLowerCase())) >= LOGIN_ACCOUNT_MISSES
}

/** Сәтті кіру есептелмейді; тек қате құпиясөз/белгісіз email есептеледі. */
export function recordLoginMiss(ip: string, email: string, now = Date.now()): void {
  consume('login-ip', subject(ip), HOUR, ip === 'unknown' ? 5 : LOGIN_IP_MISSES, now)
  consume('login-account', subject(email.trim().toLowerCase()), HOUR, LOGIN_ACCOUNT_MISSES, now)
}

/** Қалпына келтіру хаты: IP-ге сағатына 10, аккаунтқа сағатына 3. */
export function allowPasswordResetRequest(ip: string, email: string, now = Date.now()): boolean {
  if (!consume('password-reset-ip', subject(ip), HOUR, ip === 'unknown' ? 5 : 10, now)) return false
  return consume('password-reset-account', subject(email.trim().toLowerCase()), HOUR, 3, now)
}

/** SQLite бір VPS-та ортақ. BEGIN IMMEDIATE есептегіш жарысын болдырмайды. */
function consume(bucket: string, identity: string, duration: number, maximum: number, now: number): boolean {
  const database = db()
  const start = Math.floor(now / duration) * duration
  database.exec('BEGIN IMMEDIATE')
  try {
    database.prepare('DELETE FROM request_limits WHERE window_start < ?').run(now - DAY)
    const row = database.prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
      .get(bucket, identity, start) as { attempts: number } | undefined
    if ((row?.attempts ?? 0) >= maximum) {
      database.exec('COMMIT')
      return false
    }
    database.prepare(`INSERT INTO request_limits (bucket, subject, window_start, attempts) VALUES (?, ?, ?, 1)
      ON CONFLICT(bucket, subject, window_start) DO UPDATE SET attempts = request_limits.attempts + 1`).run(bucket, identity, start)
    database.exec('COMMIT')
    return true
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

/** Бір IP-ден 20 қате/сағат және бір кодқа 5 қате/сағат. */
export function allowShareMiss(ip: string, code: string, now = Date.now()): boolean {
  if (!consume('share-ip', subject(ip), HOUR, shareIpMaximum(ip), now)) return false
  return consume('share-code', subject(ip, code), HOUR, 5, now)
}

/** Аноним код жасау DB-де 24 сағат сақталады; бір IP-ден 10/сағ, белгісіз IP-ден 3/сағ. */
export function allowAnonymousShareCreate(ip: string, now = Date.now()): boolean {
  return consume('share-create', subject(ip), HOUR, ip === 'unknown' ? 3 : 10, now)
}

/** Үлкен body-ді оқымай тұрып аноним share лимитін арзан тексеру. */
export function isAnonymousShareCreateLimited(ip: string, now = Date.now()): boolean {
  const start = Math.floor(now / HOUR) * HOUR
  const row = db().prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
    .get('share-create', subject(ip), start) as { attempts: number } | undefined
  return (row?.attempts ?? 0) >= (ip === 'unknown' ? 3 : 10)
}

export function isShareLimited(ip: string, code: string, now = Date.now()): boolean {
  const database = db()
  const start = Math.floor(now / HOUR) * HOUR
  const count = (bucket: string, identity: string): number => {
    const row = database.prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
      .get(bucket, identity, start) as { attempts: number } | undefined
    return row?.attempts ?? 0
  }
  return count('share-ip', subject(ip)) >= shareIpMaximum(ip) || count('share-code', subject(ip, code)) >= 5
}

/** Бір IP бір share-ге минутына ең көбі бес пікір жазады. */
export function allowComment(ip: string, code: string, now = Date.now()): boolean {
  return consume('comment', subject(ip, code), MINUTE, 5, now)
}

/** OpenAI шығыны цехқа ортақ: рендер 4/сағ, 20/күн; мәтін 20/сағ, 100/күн. */
export function allowAiRequest(shopId: string, kind: 'render' | 'text', now = Date.now()): boolean {
  const maximum = kind === 'render' ? [4, 20] : [20, 100]
  const identity = subject(shopId)
  const windows = [HOUR, DAY].map((duration, index) => ({
    bucket: `ai-${kind}-${index === 0 ? 'hour' : 'day'}`,
    start: Math.floor(now / duration) * duration,
    maximum: maximum[index]!,
  }))
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    database.prepare('DELETE FROM request_limits WHERE window_start < ?').run(now - DAY)
    for (const window of windows) {
      const row = database.prepare('SELECT attempts FROM request_limits WHERE bucket = ? AND subject = ? AND window_start = ?')
        .get(window.bucket, identity, window.start) as { attempts: number | string } | undefined
      if (Number(row?.attempts ?? 0) >= window.maximum) {
        database.exec('COMMIT')
        return false
      }
    }
    for (const window of windows) {
      database.prepare(`INSERT INTO request_limits (bucket, subject, window_start, attempts) VALUES (?, ?, ?, 1)
        ON CONFLICT(bucket, subject, window_start) DO UPDATE SET attempts = request_limits.attempts + 1`)
        .run(window.bucket, identity, window.start)
    }
    database.exec('COMMIT')
    return true
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}
