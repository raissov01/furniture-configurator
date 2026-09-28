'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { closeModal, hasModal, isTopModal, modalZIndex, openModal } from '@/lib/modalStack'

let stack: string[] = []
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getSnapshot = () => stack
const notify = () => { for (const listener of listeners) listener() }
export const hasOpenModal = (): boolean => hasModal(stack)
export const isTopOpenModal = (id: string): boolean => isTopModal(stack, id)
export const useTourBlockedByModal = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getSnapshot).some((id) => id !== 'properties')

/** Терезенің ашылған ретіне сәйкес қабат; бір уақытта екі терезе болса, соңғысы үстінде. */
export function useModalLayer(open: boolean, id: string, onEscape?: () => void): { zIndex: number; isTop: boolean } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    if (!open) return
    stack = openModal(stack, id)
    notify()
    return () => {
      stack = closeModal(stack, id)
      notify()
    }
  }, [open, id])
  useEffect(() => {
    if (!open || !escapeRef.current) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopModal(stack, id)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      escapeRef.current?.()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, id])
  return { zIndex: modalZIndex(current, id), isTop: isTopModal(current, id) }
}
