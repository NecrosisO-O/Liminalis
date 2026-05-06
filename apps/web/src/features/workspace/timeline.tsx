import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api, type ConfidentialityLevel, type TimelineItem } from '../../shared/api/client.ts'
import { decryptSourceMetadata, type SourceMetadata } from '../../shared/crypto/envelope.ts'
import { EmptyState, IconButton, Toast } from '../../shared/ui/components.tsx'
import { confidentialityClass, confidentialityLabel, formatShortDate, formatTime24 } from '../../shared/ui/format.ts'
import {
  classifySelection,
  downloadShareObject,
  downloadSourceItem,
  entriesFromFileList,
  formatBytes,
  itemObjectIds,
  largeFileThresholdBytes,
  uploadFileSelection,
  uploadTextItem,
} from '../../shared/files/transfer.ts'

const confidentialityOptions: ConfidentialityLevel[] = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET']
const collapsedTextLines = 3
const composerMaxTextAreaHeight = 148

function nextLevel(current: ConfidentialityLevel) {
  const index = confidentialityOptions.indexOf(current)
  return confidentialityOptions[(index + 1) % confidentialityOptions.length] ?? 'SECRET'
}

function avatarLabel(sourceLabel: string) {
  const trimmed = sourceLabel.trim()
  return (trimmed[0] ?? 'L').toUpperCase()
}

function timelineMeta(item: TimelineItem) {
  const time = formatTime24(item.createdTime)
  return item.timelineOrigin === 'CURRENT_DEVICE' ? `${item.sourceLabel} · ${time}` : `${time} · ${item.sourceLabel}`
}

function timelineOriginClass(item: TimelineItem) {
  return item.timelineOrigin.toLowerCase().replaceAll('_', '-')
}

function groupTimeline(items: TimelineItem[]) {
  return [...items]
    .sort((left, right) => new Date(left.createdTime).getTime() - new Date(right.createdTime).getTime())
    .reduce<Array<{ label: string; items: TimelineItem[] }>>((groups, item) => {
      const label = formatShortDate(item.createdTime)
      const current = groups.at(-1)
      if (current?.label === label) {
        current.items.push(item)
      } else {
        groups.push({ label, items: [item] })
      }

      return groups
    }, [])
}

function itemTitle(item: TimelineItem) {
  return item.displayTitle ?? (item.visibleTypeLabel === 'text' ? 'Text' : 'Untitled item')
}

function filenameExtension(displayName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(displayName.trim())
  return match?.[1].toLowerCase() ?? ''
}

function hasExtension(extension: string, values: readonly string[]) {
  return extension !== '' && values.includes(extension)
}

function fileIconKind(item: TimelineItem, displayName: string, metadata: SourceMetadata | null | undefined) {
  const contentType = metadata?.contentType?.toLowerCase() ?? ''
  const visibleType = item.visibleTypeLabel.toLowerCase()
  const extension = filenameExtension(displayName)

  if (item.groupedItemCount || visibleType.includes('group')) {
    return 'folder'
  }

  if (contentType === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }

  if (contentType.startsWith('image/') || hasExtension(extension, ['avif', 'bmp', 'gif', 'heic', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff', 'webp'])) {
    return 'image'
  }

  if (contentType.startsWith('video/') || hasExtension(extension, ['avi', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'webm', 'wmv'])) {
    return 'video'
  }

  if (contentType.startsWith('audio/') || hasExtension(extension, ['aac', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav'])) {
    return 'audio'
  }

  if (
    contentType.includes('zip') ||
    contentType.includes('compressed') ||
    hasExtension(extension, ['7z', 'bz2', 'gz', 'rar', 'tar', 'tgz', 'xz', 'zip'])
  ) {
    return 'archive'
  }

  if (
    contentType.includes('spreadsheet') ||
    contentType === 'text/csv' ||
    hasExtension(extension, ['csv', 'ods', 'tsv', 'xls', 'xlsx'])
  ) {
    return 'sheet'
  }

  if (contentType.includes('presentation') || hasExtension(extension, ['key', 'odp', 'ppt', 'pptx'])) {
    return 'slides'
  }

  if (
    contentType.includes('wordprocessing') ||
    contentType.includes('msword') ||
    hasExtension(extension, ['doc', 'docx', 'odt', 'pages', 'rtf'])
  ) {
    return 'document'
  }

  if (
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript') ||
    hasExtension(extension, ['c', 'cpp', 'css', 'go', 'h', 'html', 'java', 'js', 'json', 'jsx', 'kt', 'php', 'py', 'rb', 'rs', 'sh', 'sql', 'swift', 'ts', 'tsx', 'xml', 'yaml', 'yml'])
  ) {
    return 'code'
  }

  if (contentType.startsWith('text/') || hasExtension(extension, ['log', 'md', 'markdown', 'txt'])) {
    return 'text'
  }

  return 'file'
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-3.4" />
      <path d="m8.7 13.3 6.6 3.4" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m21 11.2-8.9 8.9a5.4 5.4 0 0 1-7.7-7.7l9.4-9.4a3.7 3.7 0 0 1 5.2 5.2l-9.4 9.4a2 2 0 0 1-2.8-2.8l8.7-8.7" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  )
}

function FileKindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'folder':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3.5 7.5h6l2 2h9v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2Z" />
          <path d="M3.5 7.5v-1a2 2 0 0 1 2-2h4l2 3" />
        </svg>
      )
    case 'pdf':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 3.5h7l3 3v14H7Z" />
          <path d="M14 3.5v3h3" />
          <path d="M8.5 15.5c3.7-1.2 5.4-3.8 4.5-7.5" />
          <path d="M10.1 12.9c1.5.4 3.3.5 5.4.3" />
        </svg>
      )
    case 'image':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m5.8 17 4.3-4.3 2.8 2.8 2.1-2.1 3.2 3.6" />
        </svg>
      )
    case 'video':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="m10 9 5 3-5 3Z" />
        </svg>
      )
    case 'audio':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 18V7l9-2v10" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="16" cy="15" r="2" />
        </svg>
      )
    case 'archive':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 8h14v11H5Z" />
          <path d="M7 5h10l2 3H5Z" />
          <path d="M10 11h4" />
        </svg>
      )
    case 'sheet':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 3.5h10v17H7Z" />
          <path d="M7 9h10" />
          <path d="M7 14h10" />
          <path d="M12 9v11.5" />
        </svg>
      )
    case 'slides':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5" y="5" width="14" height="10" rx="1.5" />
          <path d="M12 15v4" />
          <path d="M9 20h6" />
          <path d="M9 9h6" />
          <path d="M9 12h4" />
        </svg>
      )
    case 'document':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 3.5h7l3 3v14H7Z" />
          <path d="M14 3.5v3h3" />
          <path d="M9 11h6" />
          <path d="M9 14h6" />
          <path d="M9 17h4" />
        </svg>
      )
    case 'code':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m9 8-4 4 4 4" />
          <path d="m15 8 4 4-4 4" />
          <path d="m13 6-2 12" />
        </svg>
      )
    case 'text':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 3.5h10v17H7Z" />
          <path d="M9.5 8h5" />
          <path d="M9.5 11.5h5" />
          <path d="M9.5 15h3.5" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 3.5h7l3 3v14H7Z" />
          <path d="M14 3.5v3h3" />
        </svg>
      )
  }
}

function metadataKey(item: TimelineItem) {
  return `${item.id}:${JSON.stringify(item.encryptedMetadata ?? null)}`
}

function isNearTimelineBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 96
}

function TimelineTextCard({
  textBody,
  isExpanded,
  onToggle,
}: {
  textBody: string
  isExpanded: boolean
  onToggle: () => void
}) {
  const textRef = useRef<HTMLParagraphElement | null>(null)
  const [isLongText, setIsLongText] = useState(false)

  useLayoutEffect(() => {
    const element = textRef.current
    if (!element) {
      return undefined
    }

    const measure = () => {
      const computed = window.getComputedStyle(element)
      const lineHeight = Number.parseFloat(computed.lineHeight)
      const maxCollapsedHeight = Number.isFinite(lineHeight)
        ? lineHeight * collapsedTextLines
        : element.clientHeight
      setIsLongText(element.scrollHeight > maxCollapsedHeight + 1)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [textBody])

  return (
    <>
      <p ref={textRef} className={`timeline-text ${isLongText && !isExpanded ? 'is-collapsed' : ''}`}>{textBody}</p>
      {isLongText ? (
        <button className="text-toggle" type="button" onClick={onToggle}>
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      ) : null}
    </>
  )
}

export function TimelinePage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const composerTextRef = useRef<HTMLTextAreaElement | null>(null)
  const timelineStreamRef = useRef<HTMLDivElement | null>(null)
  const timelineContentRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const forceScrollToBottomRef = useRef(false)
  const initialScrollDoneRef = useRef(false)
  const knownTimelineScrollHeightRef = useRef(0)
  const [level, setLevel] = useState<ConfidentialityLevel>('SECRET')
  const [text, setText] = useState('')
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(() => new Set())
  const [metadataCache, setMetadataCache] = useState<Record<string, SourceMetadata | null>>({})
  const [toast, setToast] = useState<{ tone: 'success' | 'danger' | 'warning'; message: string } | null>(null)

  const timeline = useQuery({
    queryKey: ['timeline'],
    queryFn: api.getTimeline,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  })

  const groups = useMemo(() => groupTimeline(timeline.data ?? []), [timeline.data])
  const timelineItemsSignature = useMemo(() => (timeline.data ?? []).map((item) => `${item.id}:${item.createdTime}`).join('|'), [timeline.data])

  const scrollTimelineToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const element = timelineStreamRef.current
    if (!element) {
      return
    }

    element.scrollTo({ top: element.scrollHeight, behavior })
    knownTimelineScrollHeightRef.current = element.scrollHeight
    shouldStickToBottomRef.current = true
  }, [])

  const resizeComposerTextArea = useCallback(() => {
    const element = composerTextRef.current
    if (!element) {
      return
    }

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, composerMaxTextAreaHeight)}px`
  }, [])

  useLayoutEffect(() => {
    resizeComposerTextArea()
  }, [resizeComposerTextArea, text])

  useLayoutEffect(() => {
    const element = timelineStreamRef.current
    if (!element || !timeline.isSuccess) {
      return
    }

    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true
      forceScrollToBottomRef.current = false
      scrollTimelineToBottom('auto')
      return
    }

    if (!forceScrollToBottomRef.current && !shouldStickToBottomRef.current) {
      return
    }

    const behavior = forceScrollToBottomRef.current ? 'smooth' : 'auto'
    forceScrollToBottomRef.current = false
    scrollTimelineToBottom(behavior)
  }, [scrollTimelineToBottom, timeline.isSuccess, timelineItemsSignature])

  useEffect(() => {
    const content = timelineContentRef.current
    if (!content || !('ResizeObserver' in window)) {
      return undefined
    }

    let frame: number | null = null
    const observer = new ResizeObserver(() => {
      if (!forceScrollToBottomRef.current && !shouldStickToBottomRef.current) {
        return
      }

      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }

      frame = window.requestAnimationFrame(() => {
        scrollTimelineToBottom(forceScrollToBottomRef.current ? 'smooth' : 'auto')
        forceScrollToBottomRef.current = false
        frame = null
      })
    })
    observer.observe(content)

    return () => {
      observer.disconnect()
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [scrollTimelineToBottom])

  useEffect(() => {
    if (forceScrollToBottomRef.current) {
      const frame = window.requestAnimationFrame(() => {
        scrollTimelineToBottom('smooth')
        forceScrollToBottomRef.current = false
      })
      return () => window.cancelAnimationFrame(frame)
    }

    return undefined
  }, [metadataCache, scrollTimelineToBottom])

  useEffect(() => {
    for (const item of timeline.data ?? []) {
      if (!item.encryptedMetadata || metadataKey(item) in metadataCache) {
        continue
      }

      const ids = itemObjectIds(item)
      const retrieval = ids.shareObjectId
        ? api.issueShareRetrieval(ids.shareObjectId, `metadata-${item.id}`)
        : ids.sourceItemId
          ? api.issueSourceItemRetrieval(ids.sourceItemId, `metadata-${item.id}`)
          : null

      void retrieval
        ?.then((attempt) => decryptSourceMetadata({
          encryptedMetadata: item.encryptedMetadata,
          wrappedPayloadReference: attempt.wrappedPayloadReference,
        }))
        .then((metadata) => {
          setMetadataCache((current) => ({ ...current, [metadataKey(item)]: metadata }))
        })
        .catch(() => {
          setMetadataCache((current) => ({ ...current, [metadataKey(item)]: null }))
        })
    }
  }, [metadataCache, timeline.data])

  const sendText = useMutation({
    mutationFn: () => uploadTextItem(text.trim(), { confidentialityLevel: level }),
    onSuccess: async () => {
      setText('')
      forceScrollToBottomRef.current = true
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Text send failed.' }),
  })

  const sendFile = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > largeFileThresholdBytes) {
        throw new Error('Files above 90 MB must use Advanced upload.')
      }

      const selection = classifySelection(entriesFromFileList(fileInputRef.current?.files ?? null))
      if (!selection) {
        throw new Error('Choose a file first.')
      }

      return uploadFileSelection(selection, { confidentialityLevel: level })
    },
    onSuccess: async () => {
      setToast({ tone: 'success', message: 'File uploaded.' })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      forceScrollToBottomRef.current = true
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'File upload failed.' }),
  })

  const download = useMutation({
    mutationFn: async (item: TimelineItem) => {
      const ids = itemObjectIds(item)
      if (ids.shareObjectId) {
        return downloadShareObject(ids.shareObjectId, itemTitle(item))
      }

      if (ids.sourceItemId) {
        return downloadSourceItem(ids.sourceItemId, itemTitle(item))
      }

      throw new Error('This item is not downloadable.')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
    },
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Download failed.' }),
  })

  return (
    <section className="workspace-page timeline-page">
      <div
        className="timeline-stream"
        ref={timelineStreamRef}
        onScroll={(event) => {
          if (event.currentTarget.scrollHeight !== knownTimelineScrollHeightRef.current && shouldStickToBottomRef.current) {
            knownTimelineScrollHeightRef.current = event.currentTarget.scrollHeight
            return
          }

          shouldStickToBottomRef.current = isNearTimelineBottom(event.currentTarget)
          knownTimelineScrollHeightRef.current = event.currentTarget.scrollHeight
        }}
      >
        <div className="timeline-stream-content" ref={timelineContentRef}>
          {timeline.isLoading ? <EmptyState title="Loading timeline" detail="Retrieving active transfers." /> : null}
          {!timeline.isLoading && groups.length === 0 ? (
            <EmptyState title="No active transfers" detail="Send text or a file from the composer below." />
          ) : null}
          {groups.map((group) => (
            <section key={group.label} className="timeline-group">
              <div className="timeline-day">{group.label}</div>
              {group.items.map((item) => {
                const isText = item.visibleTypeLabel === 'text'
                const ids = itemObjectIds(item)
                const decryptedMetadata = metadataCache[metadataKey(item)]
                const textBody = decryptedMetadata?.visibleSummary ?? item.visibleSummary ?? item.displayTitle ?? 'Text item'
                const isExpanded = expandedTextIds.has(item.id)
                const title = decryptedMetadata?.displayName ?? itemTitle(item)
                const iconKind = fileIconKind(item, title, decryptedMetadata)

                return (
                  <article
                    key={item.id}
                    className={`timeline-item ${item.timelineOrigin === 'CURRENT_DEVICE' ? 'outgoing' : 'incoming'} origin-${timelineOriginClass(item)}`}
                  >
                    <div className="timeline-avatar" aria-hidden="true">{avatarLabel(item.sourceLabel)}</div>
                    <div className="timeline-content">
                      <div className="timeline-meta">{timelineMeta(item)}</div>
                      <div className={`timeline-card-row ${isText ? 'timeline-text-row' : 'timeline-file-row'} ${ids.sourceItemId && !isText ? 'has-actions' : ''}`}>
                        <div className={`timeline-card ${isText ? `timeline-card-text ${confidentialityClass(item.confidentialityLevel)}` : 'timeline-card-file'}`}>
                          {isText ? (
                            <TimelineTextCard
                              textBody={textBody}
                              isExpanded={isExpanded}
                              onToggle={() => {
                                setExpandedTextIds((current) => {
                                  const next = new Set(current)
                                  if (next.has(item.id)) {
                                    next.delete(item.id)
                                  } else {
                                    next.add(item.id)
                                  }
                                  return next
                                })
                              }}
                            />
                          ) : (
                            <button className="file-tile" type="button" onClick={() => download.mutate(item)} disabled={download.isPending}>
                              <span className={`file-kind ${confidentialityClass(item.confidentialityLevel)}`} aria-hidden="true">
                                <FileKindIcon kind={iconKind} />
                              </span>
                              <span>
                                <strong>{title}</strong>
                                <small>
                                  {item.visibleTypeLabel}
                                  {item.visibleSizeBytes ? ` · ${formatBytes(item.visibleSizeBytes)}` : ''}
                                  {item.groupedItemCount ? ` · ${item.groupedItemCount} items` : ''}
                                </small>
                              </span>
                            </button>
                          )}
                        </div>
                        {ids.sourceItemId && !isText ? (
                          <Link className="timeline-action-link share-action" to={`/app/share/${ids.sourceItemId}`} title="Share item" aria-label="Share item">
                            <ShareIcon />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>
          ))}
          <div aria-hidden="true" className="timeline-bottom-anchor" />
        </div>
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          if (text.trim()) {
            sendText.mutate()
          }
        }}
      >
        {toast ? <Toast tone={toast.tone}>{toast.message}</Toast> : null}
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              sendFile.mutate(file)
            }
          }}
        />
        <IconButton
          label={`Confidentiality: ${confidentialityLabel(level)}`}
          className={`composer-level ${confidentialityClass(level)}`}
          onClick={() => setLevel((current) => nextLevel(current))}
        >
          {level === 'TOP_SECRET' ? 'TS' : level[0]}
        </IconButton>
        <textarea
          ref={composerTextRef}
          className="input textarea composer-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={1}
          placeholder="Send text to yourself"
        />
        {text.trim() ? (
          <IconButton
            label="Send text"
            className="composer-action composer-send"
            type="submit"
            disabled={sendText.isPending}
          >
            <ArrowUpIcon />
          </IconButton>
        ) : (
          <IconButton
            label="Attach file"
            className="composer-action composer-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendFile.isPending}
          >
            <PaperclipIcon />
          </IconButton>
        )}
      </form>
    </section>
  )
}
