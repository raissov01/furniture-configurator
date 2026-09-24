'use client'

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'

type Comment = {
  id: string; code: string; targetId: string | null; body: string
  author: string; authorRole: 'client' | 'designer' | 'creator'; replyTo: string | null
}

export function CommentsInbox({ session }: { session?: { code: string; key: string } }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const load = async () => {
    try {
      const response = await fetch(session ? `/api/share/${session.code}/comments` : '/api/comments', { cache: 'no-store' })
      if (!response.ok) { setError(tr('Комментарии не загрузились')); return }
      const data = await response.json() as { comments: Comment[] }
      setComments(data.comments)
      setError('')
    } catch {
      setError(tr('Нет связи с сервером'))
    }
  }
  useEffect(() => { void load() }, [session?.code])
  const reply = async (comment: Comment) => {
    setError('')
    try {
      const response = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { 'x-share-key': session.key } : {}) },
        body: JSON.stringify({ code: comment.code, replyTo: comment.id, body: body.trim() }),
      })
      if (!response.ok) {
        const data = await response.json() as { error?: string }
        setError(data.error ?? tr('Ответ не отправлен'))
        return
      }
      setBody('')
      setReplyTo(null)
      await load()
    } catch {
      setError(tr('Нет связи с сервером'))
    }
  }
  return (
    <section aria-label={tr('Комментарии клиентов')} className="rounded-lg border border-neutral-200 p-2.5 text-xs dark:border-neutral-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{tr('Комментарии клиентов')}</h3>
        <button type="button" className="underline" onClick={() => void load()}>{tr('Обновить')}</button>
      </div>
      {comments.length === 0 ? <p className="text-neutral-500">{tr('Пока нет комментариев')}</p> : null}
      <ul className="max-h-56 space-y-2 overflow-auto">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded border border-neutral-200 p-2 dark:border-neutral-700">
            <p className="text-neutral-500">{comment.code} · {comment.authorRole === 'designer' ? tr('Дизайнер')
              : comment.authorRole === 'creator' ? tr('Автор проекта') : comment.author}
              {comment.targetId ? ` · ${comment.targetId}` : ''}</p>
            <p className="whitespace-pre-wrap break-words">{comment.body}</p>
            {comment.authorRole === 'client' ? (
              replyTo === comment.id ? (
                <div className="mt-1">
                  <textarea aria-label={tr('Ответ клиенту')} value={body} maxLength={2000}
                    className="w-full rounded border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
                    onChange={(event) => setBody(event.target.value)} />
                  <button type="button" disabled={!body.trim()} className="underline disabled:opacity-40"
                    onClick={() => void reply(comment)}>{tr('Отправить ответ')}</button>
                </div>
              ) : <button type="button" className="mt-1 underline" onClick={() => setReplyTo(comment.id)}>{tr('Ответить')}</button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-red-600">{error}</p> : null}
    </section>
  )
}
