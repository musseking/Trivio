import { useRef } from 'react'
import type { MouseEvent, PointerEvent, SyntheticEvent } from 'react'
import { useModalScrollLock } from './useModalScrollLock'

/** Native dialogs receive backdrop events on the dialog itself, outside its bounds. */
export function useDialogDismiss(onDismiss: () => void) {
  const startedOutside = useRef(false)
  useModalScrollLock()

  function outside(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return false
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom
  }

  return {
    onPointerDown(event: PointerEvent<HTMLDialogElement>) {
      startedOutside.current = event.button === 0 && outside(event)
    },
    onClick(event: MouseEvent<HTMLDialogElement>) {
      const dismiss = startedOutside.current && outside(event)
      startedOutside.current = false
      if (dismiss) {
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }
    },
    onCancel(event: SyntheticEvent<HTMLDialogElement>) {
      event.preventDefault()
      event.stopPropagation()
      onDismiss()
    },
  }
}
