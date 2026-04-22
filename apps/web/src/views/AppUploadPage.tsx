import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type PrepareUploadInput } from '../lib/api.ts'

type DirectoryInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string
  directory?: string
}

type DragFileSystemEntry = {
  isFile: boolean
  isDirectory: boolean
  fullPath: string
  name: string
}

type DragFileSystemFileEntry = DragFileSystemEntry & {
  file: (callback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void
}

type DragFileSystemDirectoryEntry = DragFileSystemEntry & {
  createReader: () => {
    readEntries: (
      successCallback: (entries: DragFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void,
    ) => void
  }
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => DragFileSystemEntry | null
}

const confidentialityOptions = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET'] as const
const wheelItemHeight = 32
const defaultValidity = {
  days: 0,
  hours: 1,
  minutes: 0,
} as const
const dayOptions = Array.from({ length: 8 }, (_, index) => ({ value: index, label: String(index).padStart(2, '0') }))
const hourOptions = Array.from({ length: 24 }, (_, index) => ({ value: index, label: String(index).padStart(2, '0') }))
const minuteOptions = Array.from({ length: 60 }, (_, index) => ({ value: index, label: String(index).padStart(2, '0') }))

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${bytes} B`
}

type SelectedUpload = {
  files: SelectedUploadFile[]
  contentKind: 'SINGLE_FILE' | 'GROUPED_CONTENT'
  groupStructureKind?: 'MULTI_FILE' | 'FOLDER'
  inferredLabel: string
}

type SelectedUploadFile = {
  file: File
  path: string
}

function inferUpload(files: SelectedUploadFile[]): SelectedUpload | null {
  if (files.length === 0) {
    return null
  }

  const hasFolderPaths = files.some((entry) => entry.path.includes('/'))

  if (files.length === 1 && !hasFolderPaths) {
    return {
      files,
      contentKind: 'SINGLE_FILE',
      inferredLabel: files[0]?.file.name ?? 'Uploaded file',
    }
  }

  if (hasFolderPaths) {
    const firstFolderName = files[0]?.path.split('/')[0] || 'Folder upload'
    return {
      files,
      contentKind: 'GROUPED_CONTENT',
      groupStructureKind: 'FOLDER',
      inferredLabel: firstFolderName,
    }
  }

  return {
    files,
    contentKind: 'GROUPED_CONTENT',
    groupStructureKind: 'MULTI_FILE',
    inferredLabel: files.length === 1 ? files[0]?.file.name ?? 'Grouped upload' : `${files.length} files`,
  }
}

function manifestPath(file: SelectedUploadFile) {
  return file.path
}

function entriesFromFileList(files: FileList | null): SelectedUploadFile[] {
  return files
    ? Array.from(files).map((file) => ({
        file,
        path: file.webkitRelativePath || file.name,
      }))
    : []
}

function readFileEntry(entry: DragFileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

function readDirectoryEntries(directory: DragFileSystemDirectoryEntry): Promise<DragFileSystemEntry[]> {
  const reader = directory.createReader()
  const entries: DragFileSystemEntry[] = []

  return new Promise<DragFileSystemEntry[]>((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(entries)
            return
          }

          entries.push(...batch)
          readBatch()
        },
        reject,
      )
    }

    readBatch()
  })
}

async function collectDroppedFiles(entries: DragFileSystemEntry[], parentPath = ''): Promise<SelectedUploadFile[]> {
  const collected: SelectedUploadFile[] = []

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await readFileEntry(entry as DragFileSystemFileEntry)
      const nextPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
      collected.push({ file, path: nextPath })
      continue
    }

    if (entry.isDirectory) {
      const childEntries = await readDirectoryEntries(entry as DragFileSystemDirectoryEntry)
      const nextParentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
      const children = await collectDroppedFiles(childEntries, nextParentPath)
      collected.push(...children)
    }
  }

  return collected
}

type DurationWheelColumnProps = {
  label: string
  options: Array<{ value: number; label: string }>
  selectedValue: number
  onSelect: (value: number) => void
}

function DurationWheelColumn({ label, options, selectedValue, onSelect }: DurationWheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollTimeoutRef = useRef<number | null>(null)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  )

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) {
      return
    }

    const nextScrollTop = selectedIndex * wheelItemHeight
    if (Math.abs(scrollElement.scrollTop - nextScrollTop) > 1) {
      scrollElement.scrollTop = nextScrollTop
    }
  }, [selectedIndex])

  function syncSelectionFromScroll() {
    const scrollElement = scrollRef.current
    if (!scrollElement) {
      return
    }

    const nextIndex = Math.min(options.length - 1, Math.max(0, Math.round(scrollElement.scrollTop / wheelItemHeight)))
    scrollElement.scrollTop = nextIndex * wheelItemHeight
    const nextValue = options[nextIndex]?.value
    if (nextValue !== undefined && nextValue !== selectedValue) {
      onSelect(nextValue)
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const direction = event.deltaY > 0 ? 1 : -1
    const nextIndex = Math.min(options.length - 1, Math.max(0, selectedIndex + direction))
    const nextValue = options[nextIndex]?.value
    if (nextValue !== undefined && nextValue !== selectedValue) {
      onSelect(nextValue)
    }
  }

  function handleScroll() {
    if (scrollTimeoutRef.current !== null) {
      window.clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      syncSelectionFromScroll()
      scrollTimeoutRef.current = null
    }, 80)
  }

  return (
    <div className="duration-wheel-column">
      <span className="duration-wheel-label">{label}</span>
      <div className="duration-wheel-shell">
        <div className="duration-wheel-highlight" aria-hidden="true">
          <span>{options[selectedIndex]?.label}</span>
        </div>
        <div ref={scrollRef} className="duration-wheel-scroll" onScroll={handleScroll} onWheel={handleWheel}>
          {options.map((option) => (
            <button
              key={`${label}-${option.value}`}
              className={option.value === selectedValue ? 'duration-wheel-option selected' : 'duration-wheel-option'}
              type="button"
              onClick={() => onSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AppUploadPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([])
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<(typeof confidentialityOptions)[number]>('SECRET')
  const [displayName, setDisplayName] = useState('')
  const [validityDays, setValidityDays] = useState<number>(defaultValidity.days)
  const [validityHours, setValidityHours] = useState<number>(defaultValidity.hours)
  const [validityMinutes, setValidityMinutes] = useState<number>(defaultValidity.minutes)
  const [burnAfterReadEnabled, setBurnAfterReadEnabled] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const selectedUpload = useMemo(() => inferUpload(selectedFiles), [selectedFiles])
  const totalBytes = useMemo(() => selectedFiles.reduce((sum, entry) => sum + entry.file.size, 0), [selectedFiles])

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUpload) {
        throw new Error('Select a file, multiple files, or a folder first.')
      }

      const hasEmptyFile = selectedUpload.files.some((entry) => entry.file.size < 1)
      if (hasEmptyFile) {
        throw new Error('Empty files are not supported in this upload flow.')
      }

      const requestedValidityMinutes = validityDays * 24 * 60 + validityHours * 60 + validityMinutes
      if (!Number.isFinite(requestedValidityMinutes) || requestedValidityMinutes <= 0) {
        throw new Error('Choose a duration greater than zero.')
      }

      const prepareInput: PrepareUploadInput = {
        contentKind: selectedUpload.contentKind,
        confidentialityLevel,
        requestedValidityMinutes,
        burnAfterReadEnabled,
        groupStructureKind: selectedUpload.groupStructureKind,
      }

      const prepared = await api.prepareUpload(prepareInput)

      await Promise.all(
        selectedUpload.files.map((entry, index) =>
          api.registerUploadPart(prepared.uploadSessionId, {
            partNumber: index + 1,
            storageKey: `upload://${crypto.randomUUID()}/${encodeURIComponent(manifestPath(entry))}`,
            byteSize: entry.file.size,
            checksum: `${entry.file.type || 'application/octet-stream'}:${entry.file.lastModified}:${entry.file.size}`,
          }),
        ),
      )

      return api.finalizeUpload(prepared.uploadSessionId, {
        displayName: displayName.trim() || selectedUpload.inferredLabel,
        manifest:
          selectedUpload.contentKind === 'GROUPED_CONTENT'
            ? {
                members: selectedUpload.files.map((entry, index) => ({
                  path: manifestPath(entry),
                  partNumber: index + 1,
                  byteSize: entry.file.size,
                  contentType: entry.file.type || 'application/octet-stream',
                })),
              }
            : undefined,
      })
    },
    onSuccess: async () => {
      const nextLabel = displayName.trim() || selectedUpload?.inferredLabel || 'Upload'
      setUploadMessage(`${nextLabel} created.`)
      setSelectedFiles([])
      setDisplayName('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
      setValidityDays(defaultValidity.days)
      setValidityHours(defaultValidity.hours)
      setValidityMinutes(defaultValidity.minutes)
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: () => {
      setUploadMessage(null)
    },
  })

  function handleSelectFiles(files: FileList | null) {
    setUploadMessage(null)
    setSelectedFiles(entriesFromFileList(files))
  }

  function openPicker() {
    fileInputRef.current?.click()
  }

  function openFolderPicker(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    folderInputRef.current?.click()
  }

  function clearSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setSelectedFiles([])
    setUploadMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragActive(false)
    setUploadMessage(null)

    const items = Array.from(event.dataTransfer.items ?? []) as DataTransferItemWithEntry[]
    const entries: DragFileSystemEntry[] = []

    for (const item of items) {
      const entry = item.webkitGetAsEntry?.() ?? null
      if (entry) {
        entries.push(entry)
      }
    }

    if (entries.length > 0) {
      const droppedFiles = await collectDroppedFiles(entries)
      if (droppedFiles.length > 0) {
        setSelectedFiles(droppedFiles)
        return
      }
    }

    setSelectedFiles(entriesFromFileList(event.dataTransfer.files))
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragActive(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setIsDragActive(false)
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    openPicker()
  }

  return (
    <section className="workspace-page upload-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Upload</p>
          <h2>Advanced upload</h2>
        </div>
      </header>

      <form
        className="panel page-panel upload-form upload-surface"
        onSubmit={(event) => {
          event.preventDefault()
          uploadMutation.mutate()
        }}
      >
        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          multiple
          onChange={(event) => handleSelectFiles(event.target.files)}
        />

        <input
          ref={folderInputRef}
          {...({ webkitdirectory: '', directory: '' } satisfies DirectoryInputProps)}
          className="hidden-file-input"
          type="file"
          multiple
          onChange={(event) => handleSelectFiles(event.target.files)}
        />

        <div
          className={isDragActive ? 'surface-card upload-selection-card upload-selection-trigger drag-active' : 'surface-card upload-selection-card upload-selection-trigger'}
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={handleCardKeyDown}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {selectedUpload ? (
            <>
              <div className="upload-selection-summary">
                <div>
                  <p className="eyebrow">Selection</p>
                  <strong>{selectedUpload.inferredLabel}</strong>
                </div>

                <div className="upload-selection-side">
                  <div className="upload-summary-badges">
                    <span className="upload-badge">{selectedUpload.contentKind === 'SINGLE_FILE' ? 'Single file' : 'File group'}</span>
                    <span className="upload-badge">{selectedFiles.length} item{selectedFiles.length === 1 ? '' : 's'}</span>
                    <span className="upload-badge">{formatBytes(totalBytes)}</span>
                  </div>
                  <button className="upload-inline-link" type="button" onClick={clearSelection}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="upload-file-list">
                {selectedFiles.slice(0, 8).map((entry) => (
                  <div key={`${manifestPath(entry)}:${entry.file.lastModified}:${entry.file.size}`} className="upload-file-row">
                    <span className="upload-file-name">{manifestPath(entry)}</span>
                    <span className="muted">{formatBytes(entry.file.size)}</span>
                  </div>
                ))}

                {selectedFiles.length > 8 ? (
                  <p className="muted upload-file-overflow">+ {selectedFiles.length - 8} more files</p>
                ) : null}
              </div>

              <p className="muted upload-selection-hint">Click to replace with files, or use the folder link below.</p>
              <button className="upload-inline-link" type="button" onClick={openFolderPicker}>
                Choose folder instead
              </button>
            </>
          ) : (
            <div className="upload-empty-state">
              <strong>Choose files</strong>
              <p className="muted">Click or drag files here. Need a folder upload instead? Drag a folder here or use the link below.</p>
              <button className="upload-inline-link" type="button" onClick={openFolderPicker}>
                Choose folder instead
              </button>
            </div>
          )}
        </div>

        <div className="upload-control-row">
          <label className="field">
            <span>Confidentiality</span>
            <select
              value={confidentialityLevel}
              onChange={(event) => setConfidentialityLevel(event.target.value as typeof confidentialityLevel)}
            >
              {confidentialityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field upload-display-name-field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={selectedUpload?.inferredLabel ?? 'Optional override'}
            />
          </label>
        </div>

        <section className="upload-validity-card upload-validity-row">
          <span className="duration-wheel-label">Expiry</span>
          <div className="duration-wheel-grid">
            <DurationWheelColumn label="Days" options={dayOptions} selectedValue={validityDays} onSelect={setValidityDays} />
            <DurationWheelColumn label="Hours" options={hourOptions} selectedValue={validityHours} onSelect={setValidityHours} />
            <DurationWheelColumn label="Minutes" options={minuteOptions} selectedValue={validityMinutes} onSelect={setValidityMinutes} />
          </div>
        </section>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={burnAfterReadEnabled}
            onChange={(event) => setBurnAfterReadEnabled(event.target.checked)}
          />
          <span>Enable burn-after-read</span>
        </label>

        {uploadMutation.error ? (
          <p className="error-text">{uploadMutation.error instanceof Error ? uploadMutation.error.message : 'Upload failed.'}</p>
        ) : null}
        {!uploadMutation.error && uploadMessage ? <p className="muted">{uploadMessage}</p> : null}

        <div className="button-row">
          <button className="primary-button" type="submit" disabled={!selectedUpload || uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </section>
  )
}
