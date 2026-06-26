import { ComponentChildren } from 'preact'
import { Modal } from './Modal'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  description?: ComponentChildren
  confirmLabel?: string
  cancelLabel?: string
  confirmClassName?: string
  confirmDisabled?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmClassName = 'btn-primary',
  confirmDisabled = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {description && (
        <div class="rounded-lg border border-base-200 bg-base-200/40 p-4">
          <p class="text-sm leading-6 text-base-content/70">{description}</p>
        </div>
      )}
      <div class="modal-action border-t border-base-200 pt-4">
        <button type="button" class="btn btn-ghost" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          class={`btn ${confirmClassName}`}
          onClick={onConfirm}
          disabled={confirmDisabled || isLoading}
        >
          {isLoading ? (
            <span class="loading loading-spinner loading-sm"></span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  )
}
