import { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
  boxClassName?: string
}

export function Modal({ isOpen, onClose, title, children, boxClassName }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (e: MouseEvent) => {
    const dialog = dialogRef.current
    if (e.target === dialog) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      class="modal"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div
        class={`modal-box flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 p-0 shadow-2xl ${boxClassName ?? ''}`}
      >
        <div class="flex items-start justify-between gap-4 border-b border-base-200 bg-base-100 px-6 py-4">
          <div class="min-w-0">
            <h3 class="truncate text-lg font-semibold leading-6 text-base-content">
              {title}
            </h3>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle shrink-0"
            onClick={onClose}
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </dialog>
  )
}
