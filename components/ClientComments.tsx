'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'

type Comment = {
  id: string; targetId: string | null; body: string; author: string; authorRole: 'client' | 'designer' | 'creator'
  replyTo: string | null; createdAt: number
}

export function ClientComments({ code, objects }: { code: string; objects: { id: string; name: string }[] }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [author, setAuthor] = useState('')
  const [body, setBody] = useState('')
  const [targetId, setTargetId] = useState<string>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const response = await fetch(`/api/share/${code}/comments`, { cache: 'no-store' })
      if (!response.ok) {
        setError(tr('Комментарии не загрузились'))
        return
      }
      const data = await response.json() as { comments: Comment[] }
      setComments(data.comments)
      setError('')
    } catch {
      setError(tr('Нет связи с сервером'))
    }
  }
  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, 5000)
    return () => clearInterval(timer)
  }, [code])

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/share/${code}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author.trim(), body: body.trim(), targetId: targetId || null }),
      })
      if (!response.ok) {
        const data = await response.json() as { error?: string }
        setError(data.error ?? tr('Комментарий не отправлен'))
        return
      }
      setBody('')
      await load()
    } catch {
      setError(tr('Нет связи с сервером'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="max-h-64 overflow-auto border-t border-neutral-800 px-4 py-3 text-xs" aria-label={tr('Комментарии')}>
      <h2 className="mb-2 font-semibold">{tr('Комментарии')}</h2>
      <ul className="mb-3 space-y-2">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded border border-neutral-800 px-2 py-1">
            <span className="text-neutral-400">{comment.authorRole === 'designer' ? tr('Дизайнер')
              : comment.authorRole === 'creator' ? tr('Автор проекта') : comment.author}</span>
            {comment.targetId ? <span className="ml-2 text-neutral-500">{objects.find((item) => item.id === comment.targetId)?.name ?? comment.targetId}</span> : null}
            <p className="whitespace-pre-wrap break-words">{comment.body}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
        <input className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1" value={author}
          maxLength={60} placeholder={tr('Ваше имя')} aria-label={tr('Ваше имя')}
          onChange={(event) => setAuthor(event.target.value)} />
        <select className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1" value={targetId}
          aria-label={tr('Объект комментария')} onChange={(event) => setTargetId(event.target.value)}>
          <option value="">{tr('К проекту в целом')}</option>
          {objects.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}
        </select>
      </div>
      <textarea className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1" value={body}
        maxLength={2000} rows={2} aria-label={tr('Комментарий')} placeholder={tr('Ваш комментарий')}
        onChange={(event) => setBody(event.target.value)} />
      {error ? <p role="alert" className="text-red-400">{error}</p> : null}
      <button type="button" className="mt-1 rounded border border-neutral-500 px-3 py-1 disabled:opacity-40"
        disabled={busy || !author.trim() || !body.trim()} onClick={() => void send()}>{tr('Отправить')}</button>
    </section>
  )
}
