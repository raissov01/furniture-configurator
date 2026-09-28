'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { closeModal, modalZIndex, openModal } from '@/lib/modalStack'

let stack: string[] = []
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getSnapshot = () => stack
const notify = () => { for (const listener of listeners) listener() }

export const getModalStack = (): readonly string[] => stack

export const useModalStack = (): readonly string[] => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

/** Терезенің ашылған ретіне сәйкес қабат; бір уақытта екі терезе болса, соңғысы үстінде. */
export function useModalLayer(open: boolean, id: string): { zIndex: number; isTop: boolean } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (!open) return
    stack = openModal(stack, id)
    notify()
    return () => {
      stack = closeModal(stack, id)
      notify()
    }
  }, [open, id])
  return { zIndex: modalZIndex(current, id), isTop: current.at(-1) === id }
}
