import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type TimelineItem } from '../lib/api.ts'
import { useTimelineQuery } from '../hooks/useTimelineQuery.ts'

const confidentialityOptions = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET'] as const
const maxLightweightFileBytes = 90 * 1024 * 1024

function nextConfidentiality(
  current: (typeof confidentialityOptions)[number],
): (typeof confidentialityOptions)[number] {
  const currentIndex = confidentialityOptions.indexOf(current)
  return confidentialityOptions[(currentIndex + 1) % confidentialityOptions.length]
}

function formatTime(input: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input))
}

function validityClass(item: TimelineItem) {
  if (!item.validUntil) {
    return 'safe'
  }

  const validUntil = new Date(item.validUntil).getTime()
  const now = Date.now()

  if (!Number.isFinite(validUntil) || validUntil <= now) {
    return 'urgent'
  }

  const remainingMs = validUntil - now

  if (remainingMs <= 10 * 60 * 1000) {
    return 'urgent'
  }

  if (remainingMs <= 30 * 60 * 1000) {
    return 'warning'
  }

  return 'safe'
}

function confidentialityClass(level: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET') {
  return `confidentiality-${level.toLowerCase()}`
}

function preferredTextContent(primary: string | null | undefined, fallback: string) {
  return primary && primary.trim() !== '' ? primary : fallback
}

function timelineObjectType(item: TimelineItem) {
  return (item.sourceObjectType ?? item.objectType ?? '').toLowerCase()
}

function timelineObjectId(item: TimelineItem) {
  return item.sourceObjectId ?? item.objectId ?? item.id
}

type TimelineTextBubbleProps = {
  item: TimelineItem
  isExpanded: boolean
  onToggle: () => void
}

function TimelineTextBubble({ item, isExpanded, onToggle }: TimelineTextBubbleProps) {
  const objectType = timelineObjectType(item)
  const objectId = timelineObjectId(item)
  const collapsedText = preferredTextContent(item.visibleSummary, item.displayTitle ?? 'Text item')
  const fullTextQuery = useQuery({
    queryKey: ['source-item', objectId],
    queryFn: () => api.getSourceItem(objectId),
    enabled: isExpanded && objectType === 'source_item' && objectId !== '',
    retry: false,
  })
  const expandedText = preferredTextContent(fullTextQuery.data?.textCiphertextBody, collapsedText)
  const textContent = isExpanded ? expandedText : collapsedText
  const isLongText = collapsedText.length > 220 || expandedText.length > collapsedText.length

  return (
    <div className={`text-bubble ${confidentialityClass(item.confidentialityLevel)}`}>
      <p className={isExpanded ? 'text-bubble-content expanded' : 'text-bubble-content'}>{textContent}</p>
      {isLongText ? (
        <button className="text-toggle" type="button" onClick={onToggle}>
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      ) : null}
    </div>
  )
}

export function AppTimelinePage() {
  const queryClient = useQueryClient()
  const timelineQuery = useTimelineQuery()
  const timelineStreamRef = useRef<HTMLDivElement | null>(null)
  const didAutoScrollRef = useRef(false)
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedConfidentiality, setSelectedConfidentiality] =
    useState<(typeof confidentialityOptions)[number]>('SECRET')
  const [textValue, setTextValue] = useState('')
  const [fileToast, setFileToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [expandedTextIds, setExpandedTextIds] = useState<string[]>([])
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const hasText = textValue.trim() !== ''

  useEffect(() => {
    if (!fileToast) {
      return
    }

    const timeout = window.setTimeout(() => setFileToast(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [fileToast])

  useLayoutEffect(() => {
    const textarea = composerTextareaRef.current
    if (!textarea) {
      return
    }

    const maxHeight = 160
    textarea.style.height = '0px'
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [textValue])

  const groupedTimeline = useMemo(() => {
    const timelineItems = [...(timelineQuery.data ?? [])].sort(
      (left, right) => new Date(left.createdTime).getTime() - new Date(right.createdTime).getTime(),
    )

    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    })

    return timelineItems.reduce<Array<{ label: string; items: typeof timelineItems }>>(
      (groups, item) => {
        const label = formatter.format(new Date(item.createdTime))
        const current = groups.at(-1)
        if (current && current.label === label) {
          current.items.push(item)
          return groups
        }

        groups.push({ label, items: [item] })
        return groups
      },
      [],
    )
  }, [timelineQuery.data])

  useLayoutEffect(() => {
    if (timelineQuery.isLoading || groupedTimeline.length === 0 || didAutoScrollRef.current) {
      return
    }

    const stream = timelineStreamRef.current
    if (!stream) {
      return
    }

    stream.scrollTop = stream.scrollHeight
    setShowJumpToBottom(false)
    didAutoScrollRef.current = true
  }, [groupedTimeline.length, timelineQuery.isLoading])

  useLayoutEffect(() => {
    const stream = timelineStreamRef.current
    if (!stream) {
      return
    }

    const updateJumpButton = () => {
      const distanceFromBottom = stream.scrollHeight - stream.clientHeight - stream.scrollTop
      setShowJumpToBottom(distanceFromBottom > 120)
    }

    updateJumpButton()
    stream.addEventListener('scroll', updateJumpButton)
    return () => stream.removeEventListener('scroll', updateJumpButton)
  }, [groupedTimeline.length])

  const sendTextMutation = useMutation({
    mutationFn: async () => {
      const prepared = await api.prepareUpload({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: selectedConfidentiality,
      })

      return api.finalizeUpload(prepared.uploadSessionId, {
        displayName: textValue.trim().slice(0, 64) || 'Untitled note',
        textCiphertextBody: textValue,
      })
    },
    onSuccess: async () => {
      setTextValue('')
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
    },
  })

  const sendFileMutation = useMutation({
    mutationFn: async (file: File) => {
      setFileToast({ tone: 'success', message: `Uploading ${file.name}...` })
      const prepared = await api.prepareUpload({
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: selectedConfidentiality,
        displayName: file.name,
      })

      await api.registerUploadPart(prepared.uploadSessionId, {
        partNumber: 1,
        storageKey: `timeline://${crypto.randomUUID()}/${encodeURIComponent(file.name)}`,
        byteSize: file.size,
        checksum: `${file.type || 'application/octet-stream'}:${file.lastModified}`,
      })

      return api.finalizeUpload(prepared.uploadSessionId, {
        displayName: file.name,
      })
    },
    onSuccess: async () => {
      setFileToast({ tone: 'success', message: 'File added to timeline.' })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      requestAnimationFrame(() => {
        timelineStreamRef.current?.scrollTo({ top: timelineStreamRef.current.scrollHeight, behavior: 'smooth' })
      })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'File upload failed.'
      setFileToast({ tone: 'error', message })
    },
  })

  function handleSendText() {
    if (textValue.trim() === '') {
      return
    }

    sendTextMutation.mutate()
  }

  function handleAttachClick() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (file.size > maxLightweightFileBytes) {
      const message = 'Files larger than 90MB must use the advanced upload page.'
      setFileToast({ tone: 'error', message })
      event.target.value = ''
      return
    }

    sendFileMutation.mutate(file)
  }

  function toggleExpandedText(itemId: string) {
    setExpandedTextIds((current) =>
      current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId],
    )
  }

  function scrollTimelineToBottom() {
    const stream = timelineStreamRef.current
    if (!stream) {
      return
    }

    stream.scrollTo({ top: stream.scrollHeight, behavior: 'smooth' })
  }

  return (
    <section className="workspace-page timeline-workspace-page">
      <div className="panel page-panel timeline-shell-panel">
        {fileToast ? (
          <div className={fileToast.tone === 'error' ? 'timeline-toast error' : 'timeline-toast'}>{fileToast.message}</div>
        ) : null}

        <div ref={timelineStreamRef} className="timeline-stream-shell">
          {timelineQuery.isLoading ? (
            <div className="timeline-state" />
          ) : groupedTimeline.length === 0 ? (
            <div className="timeline-state empty" />
          ) : (
            groupedTimeline.map((group) => (
              <section key={group.label} className="timeline-group">
                <div className="timeline-group-label">{group.label}</div>

                <div className="timeline-stream-list">
                  {group.items.map((item) => {
                    const objectType = timelineObjectType(item)
                    const objectId = timelineObjectId(item)
                    const isText = item.visibleTypeLabel === 'text'
                    const sideClass = objectType === 'source_item' ? 'right' : 'left'
                    const isExpanded = expandedTextIds.includes(item.id)

                    return (
                      <article
                        key={item.id}
                        className={isText ? `timeline-entry bubble-entry ${sideClass}` : `timeline-entry card-entry ${sideClass}`}
                      >
                        <div className="timeline-avatar">{sideClass === 'right' ? 'D' : 'U'}</div>

                        <div className="timeline-content">
                          <div className="timeline-meta-row">
                            <strong>{item.sourceLabel ?? 'Unknown source'}</strong>
                            <span>{formatTime(item.createdTime)}</span>
                          </div>

                          {isText ? (
                            <TimelineTextBubble
                              item={item}
                              isExpanded={isExpanded}
                              onToggle={() => toggleExpandedText(item.id)}
                            />
                          ) : (
                            <Link to={`/app/items/${objectId}`} className="file-card file-card-link">
                              <div className={`file-icon ${confidentialityClass(item.confidentialityLevel)}`}>
                                {item.groupedItemCount ? 'G' : 'F'}
                              </div>

                              <div className="file-copy">
                                <strong>{item.displayTitle ?? 'Untitled item'}</strong>
                                <span>
                                  {item.visibleTypeLabel ?? 'item'}
                                  {item.visibleSizeLabel ? ` · ${item.visibleSizeLabel}` : ''}
                                  {item.groupedItemCount ? ` · ${item.groupedItemCount} items` : ''}
                                </span>
                              </div>

                              <div className={`validity-dot ${validityClass(item)}`} aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {showJumpToBottom ? (
          <button className="jump-to-bottom-button" type="button" onClick={scrollTimelineToBottom} aria-label="Jump to bottom">
            ↓
          </button>
        ) : null}

        <div className="timeline-bottom-composer">
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            onChange={handleFileSelected}
          />

          <div className={hasText ? 'timeline-composer-placeholder real-composer has-text' : 'timeline-composer-placeholder real-composer'}>
            <button
              className={`round-button confidentiality-button ${confidentialityClass(selectedConfidentiality)}`}
              type="button"
              aria-label="Confidentiality"
              onClick={() => setSelectedConfidentiality((current) => nextConfidentiality(current))}
            >
              {selectedConfidentiality[0]}
            </button>

            <textarea
              ref={composerTextareaRef}
              className="composer-textarea"
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              placeholder="Send text to yourself"
              rows={1}
            />

            {hasText ? (
              <button className="round-button send-button" type="button" aria-label="Send text" onClick={handleSendText}>
                ↑
              </button>
            ) : null}

            <button
              className="round-button"
              type="button"
              aria-label="Attach file"
              title="Attach file"
              onClick={handleAttachClick}
            >
              +
            </button>
          </div>

        </div>
      </div>
    </section>
  )
}
