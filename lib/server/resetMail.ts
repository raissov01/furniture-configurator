import nodemailer from 'nodemailer'

export function passwordResetMailMode(): 'smtp' | 'server-log' {
  return process.env['SMTP_HOST'] && process.env['SMTP_FROM'] && process.env['SMTP_USER'] && process.env['SMTP_PASSWORD']
    ? 'smtp' : 'server-log'
}

/** SMTP толық конфигурацияланса хат кетеді; онсыз сілтеме тек сервер логында. */
export async function sendPasswordReset(email: string, url: string): Promise<'smtp' | 'server-log'> {
  const host = process.env['SMTP_HOST']
  const from = process.env['SMTP_FROM']
  const user = process.env['SMTP_USER']
  const pass = process.env['SMTP_PASSWORD']
  if (passwordResetMailMode() === 'server-log') {
    console.info(`[password-reset] ${email}: ${url}`)
    return 'server-log'
  }
  const port = Number(process.env['SMTP_PORT'] ?? '587')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT: допустимо 1–65535')
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user, pass } })
  await transport.sendMail({ from, to: email, subject: 'AisMebel — восстановление пароля',
    text: `Чтобы задать новый пароль, откройте ссылку в течение 30 минут:\n${url}\n\nЕсли это были не вы, игнорируйте письмо.` })
  return 'smtp'
}
