import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import type { ConfidentialityLevel } from '../../shared/api/client.ts'
import { Button, Field, SelectInput, TextInput, Toast } from '../../shared/ui/components.tsx'
import {
  classifySelection,
  collectDroppedFiles,
  entriesFromFileList,
  formatBytes,
  largeFileThresholdBytes,
  type ClassifiedSelection,
  type DirectoryInputProps,
  type SelectedFileEntry,
  type UploadProgress,
  uploadFileSelection,
} from '../../shared/files/transfer.ts'

const confidentialityOptions: ConfidentialityLevel[] = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET']
const validityOptions = [
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '1 day', value: 1440 },
  { label: '7 days', value: 10080 },
  { label: 'No expiry', value: 0 },
]

function stageLabel(progress: UploadProgress | null) {
  if (!progress) {
    return 'Ready'
  }

  if (progress.stage === 'preparing') {
    return 'Preparing upload'
  }

  if (progress.stage === 'packaging') {
    return progress.currentFileName ? `Packaging ${progress.currentFileName}` : 'Packaging transfer'
  }

  if (progress.stage === 'uploading') {
    if (progress.retryAttempt) {
      return progress.partNumber ? `Retrying part ${progress.partNumber}` : 'Retrying upload'
    }

    return progress.currentFileName ? `Uploading ${progress.currentFileName}` : 'Uploading'
  }

  if (progress.stage === 'finalizing') {
    return 'Finalizing item'
  }

  return 'Complete'
}

function progressPercent(progress: UploadProgress | null, selection: ClassifiedSelection | null) {
  const total = progress?.totalBytes ?? selection?.totalBytes ?? 0
  if (total <= 0) {
    return 0
  }

  return Math.min(100, Math.round(((progress?.uploadedBytes ?? 0) / total) * 100))
}

export function AdvancedUploadPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [entries, setEntries] = useState<SelectedFileEntry[]>([])
  const [displayName, setDisplayName] = useState('')
  const [level, setLevel] = useState<ConfidentialityLevel>('SECRET')
  const [validityMinutes, setValidityMinutes] = useState(60)
  const [burnAfterRead, setBurnAfterRead] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [toast, setToast] = useState<{ tone: 'success' | 'danger' | 'warning'; message: string } | null>(null)
  const [wasBackgrounded, setWasBackgrounded] = useState(false)
  const backgroundedRef = useRef(false)
  const selection = useMemo(() => classifySelection(entries), [entries])
  const hasLargeFile = (selection?.largestFileBytes ?? 0) > largeFileThresholdBytes

  const upload = useMutation({
    mutationFn: async () => {
      if (!selection) {
        throw new Error('Choose files or a folder first.')
      }

      if (selection.contentKind === 'SINGLE_FILE' && selection.entries[0]?.file.size === 0) {
        throw new Error('Empty files are not supported for single-file upload.')
      }

      backgroundedRef.current = false
      setWasBackgrounded(false)
      setToast(null)

      return uploadFileSelection(selection, {
        confidentialityLevel: level,
        requestedValidityMinutes: validityMinutes,
        burnAfterReadEnabled: burnAfterRead,
        displayName: displayName.trim() || selection.displayName,
        onProgress: setProgress,
      })
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'Upload completed.' })
      setEntries([])
      setDisplayName('')
      setProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (error) => {
      setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Upload failed.' })
    },
  })
  const blocker = useBlocker(upload.isPending)

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return
    }

    const shouldLeave = window.confirm('An upload is still running. Leaving this page can interrupt it. Leave anyway?')
    if (shouldLeave) {
      blocker.proceed()
      return
    }

    blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (!upload.isPending) {
      return undefined
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [upload.isPending])

  useEffect(() => {
    if (!upload.isPending) {
      return undefined
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundedRef.current = true
        setWasBackgrounded(true)
        return
      }

      if (backgroundedRef.current) {
        setToast({
          tone: 'warning',
          message: 'The browser was backgrounded during upload. Liminalis will keep retrying transient chunk failures.',
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [upload.isPending])

  function setSelection(nextEntries: SelectedFileEntry[]) {
    setEntries(nextEntries)
    setProgress(null)
    setToast(null)
  }

  return (
    <section className="workspace-page upload-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Advanced upload</p>
          <h2>Files, folders, groups, and large transfers</h2>
        </div>
      </header>
      {toast ? <Toast tone={toast.tone}>{toast.message}</Toast> : null}
      <form
        className="upload-layout"
        onSubmit={(event) => {
          event.preventDefault()
          upload.mutate()
        }}
      >
        <input ref={fileInputRef} hidden type="file" multiple onChange={(event) => setSelection(entriesFromFileList(event.target.files))} />
        <input
          ref={folderInputRef}
          {...({ webkitdirectory: '', directory: '' } satisfies DirectoryInputProps)}
          hidden
          type="file"
          multiple
          onChange={(event) => setSelection(entriesFromFileList(event.target.files))}
        />
        <section
          className={dragActive ? 'dropzone active' : 'dropzone'}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragActive(false)
            }
          }}
          onDrop={async (event) => {
            event.preventDefault()
            setDragActive(false)
            setSelection(await collectDroppedFiles(event.dataTransfer))
          }}
          role="button"
          tabIndex={0}
        >
          {selection ? (
            <div className="selection-summary">
              <strong>{displayName.trim() || selection.displayName}</strong>
              <span>
                {selection.entries.length} file{selection.entries.length === 1 ? '' : 's'} · {formatBytes(selection.totalBytes)}
              </span>
              {hasLargeFile ? <span className="notice-chip">Large-file path</span> : null}
            </div>
          ) : (
            <div className="selection-summary">
              <strong>Choose files</strong>
              <span>Click, drag files, or choose a folder.</span>
            </div>
          )}
          <div className="actions">
            <Button type="button" onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click() }}>
              Files
            </Button>
            <Button type="button" onClick={(event) => { event.stopPropagation(); folderInputRef.current?.click() }}>
              Folder
            </Button>
          </div>
        </section>
        <aside className="upload-controls">
          <Field label="Display name">
            <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={selection?.displayName ?? 'Optional'} />
          </Field>
          <Field label="Confidentiality">
            <SelectInput value={level} onChange={(event) => setLevel(event.target.value as ConfidentialityLevel)}>
              {confidentialityOptions.map((option) => <option key={option}>{option}</option>)}
            </SelectInput>
          </Field>
          <Field label="Validity">
            <SelectInput value={validityMinutes} onChange={(event) => setValidityMinutes(Number(event.target.value))}>
              {validityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectInput>
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={burnAfterRead} onChange={(event) => setBurnAfterRead(event.target.checked)} />
            <span>Burn after successful read</span>
          </label>
          <div className="progress-panel">
            <div>
              <strong>{stageLabel(progress)}</strong>
              <span>{progressPercent(progress, selection)}%</span>
            </div>
            <progress value={progressPercent(progress, selection)} max={100} />
            {progress?.partNumber ? <p className="muted">Part {progress.partNumber} of {progress.partCount}</p> : null}
            {progress?.retryAttempt ? <p className="muted">Retry attempt {progress.retryAttempt} after {Math.round((progress.retryDelayMs ?? 0) / 1000)}s.</p> : null}
            {wasBackgrounded && upload.isPending ? <p className="muted">Browser was backgrounded during this upload.</p> : null}
          </div>
          {upload.error instanceof Error ? <p className="field-error">{upload.error.message}</p> : null}
          <Button variant="primary" type="submit" disabled={!selection || upload.isPending}>
            {upload.isPending ? 'Uploading' : 'Upload'}
          </Button>
        </aside>
      </form>
      {selection ? (
        <section className="file-list-panel">
          {selection.entries.slice(0, 12).map((entry) => (
            <div key={`${entry.path}:${entry.file.size}:${entry.file.lastModified}`} className="file-row">
              <span>{entry.path}</span>
              <strong>{formatBytes(entry.file.size)}</strong>
            </div>
          ))}
          {selection.entries.length > 12 ? <p className="muted">+ {selection.entries.length - 12} more files</p> : null}
        </section>
      ) : null}
    </section>
  )
}
