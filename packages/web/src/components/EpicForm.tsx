import { useState, useEffect } from 'preact/hooks'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { createEpic, updateEpic, deleteEpic, getEpics } from '../stores'
import type { Epic, Status } from '@flux/shared'
import { STATUSES, STATUS_CONFIG } from '@flux/shared'

interface EpicFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  epic?: Epic // If provided, edit mode; otherwise create mode
  projectId: string
}

export function EpicForm({ isOpen, onClose, onSave, epic, projectId }: EpicFormProps) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string>('todo')
  const [dependsOn, setDependsOn] = useState<string[]>([])
  const [availableEpics, setAvailableEpics] = useState<Epic[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isEdit = !!epic

  useEffect(() => {
    if (isOpen) {
      loadFormData()
    } else {
      setDeleteConfirmOpen(false)
    }
  }, [isOpen, epic, projectId])

  const loadFormData = async () => {
    const allEpics = await getEpics(projectId)
    setAvailableEpics(epic ? allEpics.filter(e => e.id !== epic.id) : allEpics)
    if (epic) {
      setTitle(epic.title)
      setNotes(epic.notes)
      setStatus(epic.status)
      setDependsOn([...epic.depends_on])
    } else {
      setTitle('')
      setNotes('')
      setStatus('todo')
      setDependsOn([])
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!title.trim() || submitting) return

    setSubmitting(true)
    try {
      if (isEdit && epic) {
        await updateEpic(epic.id, {
          title: title.trim(),
          notes: notes.trim(),
          status,
          depends_on: dependsOn,
        })
      } else {
        const newEpic = await createEpic(projectId, title.trim(), notes.trim())
        if (dependsOn.length > 0) {
          await updateEpic(newEpic.id, { depends_on: dependsOn })
        }
      }
      await onSave()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = () => {
    if (epic && !submitting) {
      setDeleteConfirmOpen(true)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!epic || submitting) return
    setSubmitting(true)
    try {
      await deleteEpic(epic.id)
      await onSave()
      onClose()
    } finally {
      setSubmitting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const toggleDependency = (epicId: string) => {
    setDependsOn(prev =>
      prev.includes(epicId)
        ? prev.filter(id => id !== epicId)
        : [...prev, epicId]
    )
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Workstream' : 'New Workstream'}>
        <form onSubmit={handleSubmit} class="space-y-5">
        <section class="space-y-4 rounded-lg border border-base-200 bg-base-200/30 p-4">
          <div>
            <div class="relative flex items-center gap-2">
              <h4 class="text-sm font-semibold text-base-content">Workstream details</h4>
              <div class="group inline-flex">
                <button
                  type="button"
                  class="btn btn-ghost btn-xs btn-circle text-base-content/55 hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label="A workstream groups related tasks toward one outcome. Tasks are the individual cards inside it."
                  aria-describedby="workstream-help-tooltip"
                >
                  <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <span
                  id="workstream-help-tooltip"
                  role="tooltip"
                  class="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 max-w-[calc(100vw-4rem)] rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-normal leading-5 text-base-content shadow-xl group-hover:block group-focus-within:block"
                >
                  A workstream is a larger lane or phase that groups related tasks toward one outcome. Tasks are the individual cards you move and complete inside a workstream.
                </span>
              </div>
            </div>
            <p class="mt-1 text-xs text-base-content/55">
              Group related tasks into a larger outcome, phase, or parallel area of work.
            </p>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Title *</span>
            </label>
            <input
              type="text"
              placeholder="Workstream title"
              class="input input-bordered w-full"
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              required
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Notes</span>
            </label>
            <textarea
              placeholder="Optional notes..."
              class="textarea textarea-bordered w-full"
              value={notes}
              onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
              rows={3}
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Status</span>
            </label>
            <select
              class="select select-bordered w-full"
              value={status}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
        </section>

        <section class="rounded-lg border border-base-200 bg-base-200/30 p-4">
          <div class="form-control">
            <label class="label">
                <span class="label-text">Waiting on other workstreams</span>
              {dependsOn.length > 0 && (
                <span class="label-text-alt">{dependsOn.length} selected</span>
              )}
            </label>
            {availableEpics.length === 0 ? (
              <p class="text-sm text-base-content/50">No other workstreams to wait on</p>
            ) : (
              <div class="max-h-40 overflow-y-auto rounded-lg border border-base-300">
                {availableEpics.map(e => (
                  <label key={e.id} class="flex items-center gap-2 px-3 py-2 hover:bg-base-200 cursor-pointer">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm"
                      checked={dependsOn.includes(e.id)}
                      onChange={() => toggleDependency(e.id)}
                    />
                    <span class="text-sm truncate flex-1">{e.title}</span>
                    <span class="badge badge-ghost badge-xs">{STATUS_CONFIG[e.status as Status]?.label || e.status}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>

        <div class="modal-action border-t border-base-200 pt-4">
          {isEdit && (
            <button type="button" class="btn btn-error btn-outline" onClick={handleDelete} disabled={submitting}>
              Delete
            </button>
          )}
          <button type="button" class="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={!title.trim() || submitting}>
            {submitting ? <span class="loading loading-spinner loading-sm"></span> : (isEdit ? 'Save' : 'Create')}
          </button>
        </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Workstream?"
        description="Tasks in this workstream will move to No workstream."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={handleDeleteConfirmed}
        onClose={() => {
          if (!submitting) setDeleteConfirmOpen(false)
        }}
        isLoading={submitting}
      />
    </>
  )
}
