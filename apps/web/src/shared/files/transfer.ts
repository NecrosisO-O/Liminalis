import type { InputHTMLAttributes } from 'react'
import { api, type ConfidentialityLevel, type FinalizeUploadResult, type GroupStructureKind } from '../api/client.ts'

export const largeFileThresholdBytes = 90_000_000
export const uploadChunkSizeBytes = 8 * 1024 * 1024

export type SelectedFileEntry = {
  file: File
  path: string
}

export type UploadStage = 'preparing' | 'packaging' | 'uploading' | 'finalizing' | 'complete'

export type UploadProgress = {
  stage: UploadStage
  uploadedBytes: number
  totalBytes: number
  currentFileName?: string
  partNumber?: number
  partCount?: number
}

export type UploadOptions = {
  confidentialityLevel: ConfidentialityLevel
  requestedValidityMinutes?: number
  burnAfterReadEnabled?: boolean
  displayName?: string
  onProgress?: (progress: UploadProgress) => void
}

export type ClassifiedSelection = {
  entries: SelectedFileEntry[]
  contentKind: 'SINGLE_FILE' | 'GROUPED_CONTENT'
  groupStructureKind?: GroupStructureKind
  displayName: string
  totalBytes: number
  largestFileBytes: number
}

export type PreparedTransferPayload = {
  blob: Blob
  contentKind: 'SINGLE_FILE' | 'GROUPED_CONTENT'
  groupStructureKind?: GroupStructureKind
  displayName: string
  manifest?: Record<string, unknown>
  originalFileCount: number
  originalBytes: number
}

export type DirectoryInputProps = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string
  directory?: string
}

type DragFileSystemEntry = {
  isFile: boolean
  isDirectory: boolean
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

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) {
    return '0 B'
  }

  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  }

  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`
  }

  if (bytes >= 1_000) {
    return `${(bytes / 1_000).toFixed(1)} KB`
  }

  return `${bytes} B`
}

export function entriesFromFileList(files: FileList | null): SelectedFileEntry[] {
  return files
    ? Array.from(files).map((file) => ({
        file,
        path: file.webkitRelativePath || file.name,
      }))
    : []
}

export function classifySelection(entries: SelectedFileEntry[]): ClassifiedSelection | null {
  if (entries.length === 0) {
    return null
  }

  const hasFolderPaths = entries.some((entry) => entry.path.includes('/'))
  const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0)
  const largestFileBytes = Math.max(...entries.map((entry) => entry.file.size))

  if (entries.length === 1 && !hasFolderPaths) {
    return {
      entries,
      contentKind: 'SINGLE_FILE',
      displayName: entries[0]?.file.name ?? 'Uploaded file',
      totalBytes,
      largestFileBytes,
    }
  }

  if (hasFolderPaths) {
    return {
      entries,
      contentKind: 'GROUPED_CONTENT',
      groupStructureKind: 'FOLDER',
      displayName: entries[0]?.path.split('/')[0] || 'Folder upload',
      totalBytes,
      largestFileBytes,
    }
  }

  return {
    entries,
    contentKind: 'GROUPED_CONTENT',
    groupStructureKind: 'MULTI_FILE',
    displayName: `${entries.length} files`,
    totalBytes,
    largestFileBytes,
  }
}

export function buildManifest(selection: ClassifiedSelection) {
  if (selection.contentKind !== 'GROUPED_CONTENT') {
    return undefined
  }

  return {
    structureKind: selection.groupStructureKind,
    itemCount: selection.entries.length,
    members: selection.entries.map((entry, index) => ({
      path: entry.path,
      partNumber: index + 1,
      byteSize: entry.file.size,
      contentType: entry.file.type || 'application/octet-stream',
    })),
  }
}

const crc32Table = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  crc32Table[index] = value >>> 0
}

function updateCrc32(seed: number, chunk: Uint8Array) {
  let crc = seed
  for (const byte of chunk) {
    crc = crc32Table[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }

  return crc
}

async function crc32ForFile(file: File) {
  let crc = 0xffffffff
  const reader = file.stream().getReader()

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) {
        break
      }

      crc = updateCrc32(crc, result.value)
    }
  } finally {
    reader.releaseLock()
  }

  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date: Date) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosTime, dosDate }
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function zipHeader(length: number) {
  return new Uint8Array(length)
}

function safeZipPath(path: string) {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '')
  const clean = normalized
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
    .join('/')
  return clean || 'file'
}

function ensureZipName(displayName: string) {
  return displayName.toLowerCase().endsWith('.zip') ? displayName : `${displayName}.zip`
}

function localFileHeader(input: {
  encodedName: Uint8Array
  crc32: number
  size: number
  modified: Date
}) {
  const header = zipHeader(30 + input.encodedName.length)
  const view = new DataView(header.buffer)
  const { dosTime, dosDate } = dosDateTime(input.modified)

  writeUint32(view, 0, 0x04034b50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, 0x0800)
  writeUint16(view, 8, 0)
  writeUint16(view, 10, dosTime)
  writeUint16(view, 12, dosDate)
  writeUint32(view, 14, input.crc32)
  writeUint32(view, 18, input.size)
  writeUint32(view, 22, input.size)
  writeUint16(view, 26, input.encodedName.length)
  writeUint16(view, 28, 0)
  header.set(input.encodedName, 30)

  return header
}

function centralDirectoryHeader(input: {
  encodedName: Uint8Array
  crc32: number
  size: number
  offset: number
  modified: Date
}) {
  const header = zipHeader(46 + input.encodedName.length)
  const view = new DataView(header.buffer)
  const { dosTime, dosDate } = dosDateTime(input.modified)

  writeUint32(view, 0, 0x02014b50)
  writeUint16(view, 4, 20)
  writeUint16(view, 6, 20)
  writeUint16(view, 8, 0x0800)
  writeUint16(view, 10, 0)
  writeUint16(view, 12, dosTime)
  writeUint16(view, 14, dosDate)
  writeUint32(view, 16, input.crc32)
  writeUint32(view, 20, input.size)
  writeUint32(view, 24, input.size)
  writeUint16(view, 28, input.encodedName.length)
  writeUint16(view, 30, 0)
  writeUint16(view, 32, 0)
  writeUint16(view, 34, 0)
  writeUint16(view, 36, 0)
  writeUint32(view, 38, 0)
  writeUint32(view, 42, input.offset)
  header.set(input.encodedName, 46)

  return header
}

function endOfCentralDirectory(input: {
  entryCount: number
  centralDirectorySize: number
  centralDirectoryOffset: number
}) {
  const header = zipHeader(22)
  const view = new DataView(header.buffer)

  writeUint32(view, 0, 0x06054b50)
  writeUint16(view, 4, 0)
  writeUint16(view, 6, 0)
  writeUint16(view, 8, input.entryCount)
  writeUint16(view, 10, input.entryCount)
  writeUint32(view, 12, input.centralDirectorySize)
  writeUint32(view, 16, input.centralDirectoryOffset)
  writeUint16(view, 20, 0)

  return header
}

function asBlobPart(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function buildStoredZip(entries: SelectedFileEntry[], onProgress?: (progress: UploadProgress) => void) {
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const centralDirectoryParts: Uint8Array[] = []
  const totalInputBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0)
  let packagedBytes = 0
  let offset = 0

  for (const [index, entry] of entries.entries()) {
    const path = safeZipPath(entry.path)
    const encodedName = encoder.encode(path)
    if (encodedName.length > 0xffff) {
      throw new Error(`Archive path is too long: ${path}`)
    }

    if (entry.file.size > 0xffffffff || offset > 0xffffffff) {
      throw new Error('ZIP64 archives are not supported in this browser build.')
    }

    onProgress?.({
      stage: 'packaging',
      uploadedBytes: packagedBytes,
      totalBytes: totalInputBytes,
      currentFileName: path,
      partNumber: index + 1,
      partCount: entries.length,
    })

    const crc32 = await crc32ForFile(entry.file)
    const modified = new Date(entry.file.lastModified || Date.now())
    const localHeader = localFileHeader({
      encodedName,
      crc32,
      size: entry.file.size,
      modified,
    })

    parts.push(asBlobPart(localHeader), entry.file)
    centralDirectoryParts.push(
      centralDirectoryHeader({
        encodedName,
        crc32,
        size: entry.file.size,
        offset,
        modified,
      }),
    )
    offset += localHeader.length + entry.file.size
    packagedBytes += entry.file.size

    onProgress?.({
      stage: 'packaging',
      uploadedBytes: packagedBytes,
      totalBytes: totalInputBytes,
      currentFileName: path,
      partNumber: index + 1,
      partCount: entries.length,
    })
  }

  const centralDirectoryOffset = offset
  const centralDirectorySize = centralDirectoryParts.reduce((sum, part) => sum + part.length, 0)
  if (centralDirectoryOffset > 0xffffffff || centralDirectorySize > 0xffffffff || entries.length > 0xffff) {
    throw new Error('ZIP64 archives are not supported in this browser build.')
  }

  parts.push(...centralDirectoryParts.map(asBlobPart))
  parts.push(
    asBlobPart(endOfCentralDirectory({
      entryCount: entries.length,
      centralDirectorySize,
      centralDirectoryOffset,
    })),
  )

  return new Blob(parts, { type: 'application/zip' })
}

export async function prepareTransferPayload(
  selection: ClassifiedSelection,
  onProgress?: (progress: UploadProgress) => void,
): Promise<PreparedTransferPayload> {
  if (selection.contentKind === 'SINGLE_FILE') {
    const entry = selection.entries[0]
    if (!entry) {
      throw new Error('Choose a file first.')
    }

    return {
      blob: entry.file,
      contentKind: selection.contentKind,
      displayName: selection.displayName,
      originalFileCount: 1,
      originalBytes: selection.totalBytes,
    }
  }

  const archiveName = ensureZipName(selection.displayName)
  const archive = await buildStoredZip(selection.entries, onProgress)
  const memberManifest = buildManifest(selection)

  return {
    blob: archive,
    contentKind: selection.contentKind,
    groupStructureKind: selection.groupStructureKind,
    displayName: archiveName,
    originalFileCount: selection.entries.length,
    originalBytes: selection.totalBytes,
    manifest: {
      ...memberManifest,
      archive: {
        format: 'zip-store-v1',
        fileName: archiveName,
        byteSize: archive.size,
      },
    },
  }
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<SelectedFileEntry[]> {
  const entries: DragFileSystemEntry[] = []

  for (const item of Array.from(dataTransfer.items ?? []) as DataTransferItemWithEntry[]) {
    const entry = item.webkitGetAsEntry?.() ?? null
    if (entry) {
      entries.push(entry)
    }
  }

  if (entries.length === 0) {
    return entriesFromFileList(dataTransfer.files)
  }

  const collected = await collectEntries(entries)
  return collected.length > 0 ? collected : entriesFromFileList(dataTransfer.files)
}

async function collectEntries(entries: DragFileSystemEntry[], parentPath = ''): Promise<SelectedFileEntry[]> {
  const collected: SelectedFileEntry[] = []

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await readFileEntry(entry as DragFileSystemFileEntry)
      const path = parentPath ? `${parentPath}/${entry.name}` : entry.name
      collected.push({ file, path })
      continue
    }

    if (entry.isDirectory) {
      const children = await readDirectoryEntries(entry as DragFileSystemDirectoryEntry)
      const nextParent = parentPath ? `${parentPath}/${entry.name}` : entry.name
      collected.push(...(await collectEntries(children, nextParent)))
    }
  }

  return collected
}

function readFileEntry(entry: DragFileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject)
  })
}

function readDirectoryEntries(directory: DragFileSystemDirectoryEntry) {
  const reader = directory.createReader()
  const entries: DragFileSystemEntry[] = []

  return new Promise<DragFileSystemEntry[]>((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries)
          return
        }

        entries.push(...batch)
        readBatch()
      }, reject)
    }

    readBatch()
  })
}

export async function uploadTextItem(text: string, options: UploadOptions) {
  const prepared = await api.prepareUpload({
    contentKind: 'SELF_SPACE_TEXT',
    confidentialityLevel: options.confidentialityLevel,
    requestedValidityMinutes: options.requestedValidityMinutes,
    burnAfterReadEnabled: options.burnAfterReadEnabled,
    displayName: options.displayName,
  })

  return api.finalizeUpload(prepared.uploadSessionId, {
    displayName: options.displayName ?? (text.trim().slice(0, 64) || 'Text'),
    textCiphertextBody: text,
  })
}

export async function uploadFileSelection(
  selection: ClassifiedSelection,
  options: UploadOptions,
): Promise<FinalizeUploadResult> {
  options.onProgress?.({
    stage: 'preparing',
    uploadedBytes: 0,
    totalBytes: selection.totalBytes,
  })

  const payload = await prepareTransferPayload(selection, options.onProgress)

  const prepared = await api.prepareUpload({
    contentKind: payload.contentKind,
    groupStructureKind: payload.groupStructureKind,
    confidentialityLevel: options.confidentialityLevel,
    requestedValidityMinutes: options.requestedValidityMinutes,
    burnAfterReadEnabled: options.burnAfterReadEnabled,
    displayName: options.displayName ?? payload.displayName,
    manifest: payload.manifest,
  })

  const uploadedBytes = await uploadBlobParts(prepared.uploadSessionId, payload.blob, payload.displayName, options.onProgress)

  options.onProgress?.({
    stage: 'finalizing',
    uploadedBytes,
    totalBytes: payload.blob.size,
  })

  const finalized = await api.finalizeUpload(prepared.uploadSessionId, {
    displayName: options.displayName ?? payload.displayName,
    manifest: payload.manifest,
  })

  options.onProgress?.({
    stage: 'complete',
    uploadedBytes,
    totalBytes: payload.blob.size,
  })

  return finalized
}

export async function uploadBlobParts(
  uploadSessionId: string,
  blob: Blob,
  displayName: string,
  onProgress?: (progress: UploadProgress) => void,
) {
  if (blob.size < 1) {
    throw new Error('Empty files are not supported.')
  }

  let uploadedBytes = 0
  const partCount = Math.ceil(blob.size / uploadChunkSizeBytes)

  for (let offset = 0; offset < blob.size; offset += uploadChunkSizeBytes) {
    const partNumber = Math.floor(offset / uploadChunkSizeBytes) + 1
    const chunk = blob.slice(offset, Math.min(offset + uploadChunkSizeBytes, blob.size))

    onProgress?.({
      stage: 'uploading',
      uploadedBytes,
      totalBytes: blob.size,
      currentFileName: displayName,
      partNumber,
      partCount,
    })

    await api.uploadPartBlob(uploadSessionId, partNumber, chunk)
    uploadedBytes += chunk.size

    onProgress?.({
      stage: 'uploading',
      uploadedBytes,
      totalBytes: blob.size,
      currentFileName: displayName,
      partNumber,
      partCount,
    })
  }

  return uploadedBytes
}

export function makeAttemptScope(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function contentDispositionFilename(response: Response, fallback: string) {
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/i.exec(disposition)
  return match?.[1] ? decodeURIComponent(match[1]) : fallback
}

export async function saveResponseAsDownload(response: Response, fallbackName: string) {
  const blob = await response.blob()
  saveBlobAsDownload(blob, contentDispositionFilename(response, fallbackName))
}

export function saveBlobAsDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadSourceItem(sourceItemId: string, fallbackName: string) {
  const attempt = await api.issueSourceItemRetrieval(sourceItemId, makeAttemptScope('source-download'))

  try {
    const response = await api.downloadRetrieval(attempt.retrievalAttemptId)
    await saveResponseAsDownload(response, fallbackName)
    await api.completeRetrieval(attempt.retrievalAttemptId, true)
    return attempt
  } catch (error) {
    await api.completeRetrieval(attempt.retrievalAttemptId, false).catch(() => undefined)
    throw error
  }
}

export async function downloadShareObject(shareObjectId: string, fallbackName: string) {
  const attempt = await api.issueShareRetrieval(shareObjectId, makeAttemptScope('share-download'))

  try {
    const response = await api.downloadRetrieval(attempt.retrievalAttemptId)
    await saveResponseAsDownload(response, fallbackName)
    await api.completeShareRetrieval(attempt.retrievalAttemptId, true)
    return attempt
  } catch (error) {
    await api.completeShareRetrieval(attempt.retrievalAttemptId, false).catch(() => undefined)
    throw error
  }
}

export function itemObjectIds(item: { sourceObjectType?: string; sourceObjectId?: string; sourceItemId?: string | null; shareObjectId?: string | null }) {
  const isShare = item.sourceObjectType === 'SHARE_OBJECT'
  return {
    sourceItemId: item.sourceItemId ?? (!isShare ? item.sourceObjectId : null) ?? null,
    shareObjectId: item.shareObjectId ?? (isShare ? item.sourceObjectId : null) ?? null,
  }
}
