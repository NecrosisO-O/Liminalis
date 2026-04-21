import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.ts'
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

function validityClass(index: number) {
  if (index % 3 === 0) {
    return 'safe'
  }

  if (index % 3 === 1) {
    return 'warning'
  }

  return 'urgent'
}

export function AppTimelinePage() {
  const queryClient = useQueryClient()
  const timelineQuery = useTimelineQuery()
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedConfidentiality, setSelectedConfidentiality] =
    useState<(typeof confidentialityOptions)[number]>('SECRET')
  const [textValue, setTextValue] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [expandedTextIds, setExpandedTextIds] = useState<string[]>([])
  const hasText = textValue.trim() !== ''

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
      const prepared = await api.prepareUpload({
        contentKind: 'FILE',
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
      setFileError(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
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
      setFileError('Files larger than 90MB must use the advanced upload page.')
      event.target.value = ''
      return
    }

    setFileError(null)
    sendFileMutation.mutate(file)
  }

  function toggleExpandedText(itemId: string) {
    setExpandedTextIds((current) =>
      current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId],
    )
  }

  return (
    <section className="workspace-page">
      <div className="panel page-panel timeline-shell-panel">
        <div className="timeline-stream-shell">
          {timelineQuery.isLoading ? (
            <div className="timeline-state" />
          ) : groupedTimeline.length === 0 ? (
            <div className="timeline-state empty" />
          ) : (
            groupedTimeline.map((group) => (
              <section key={group.label} className="timeline-group">
                <div className="timeline-group-label">{group.label}</div>

                <div className="timeline-stream-list">
                  {group.items.map((item, index) => {
                    const isText = item.objectType === 'source_item' && item.visibleTypeLabel === 'text'
                    const sideClass = item.objectType === 'source_item' ? 'right' : 'left'
                    const textContent = item.visibleSummary ?? item.displayTitle ?? 'Text item'
                    const isExpanded = expandedTextIds.includes(item.id)
                    const isLongText = textContent.length > 220

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
                            <div className={`text-bubble confidentiality-${item.confidentialityLevel.toLowerCase()}`}>
                              <p className={isExpanded ? 'text-bubble-content expanded' : 'text-bubble-content'}>
                                {textContent}
                              </p>
                              {isLongText ? (
                                <button className="text-toggle" type="button" onClick={() => toggleExpandedText(item.id)}>
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <Link to={`/app/items/${item.objectId}`} className="file-card file-card-link">
                              <div className={`file-icon confidentiality-${item.confidentialityLevel.toLowerCase()}`}>
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

                              <div className={`validity-dot ${validityClass(index)}`} aria-hidden="true" />
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

        <div className="timeline-bottom-composer">
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            onChange={handleFileSelected}
          />

          <div className={hasText ? 'timeline-composer-placeholder real-composer has-text' : 'timeline-composer-placeholder real-composer'}>
            <button
              className={`round-button confidentiality-button confidentiality-${selectedConfidentiality.toLowerCase()}`}
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

          {fileError ? <p className="error-text composer-error">{fileError}</p> : null}
          {sendFileMutation.isPending ? <p className="muted composer-status">Uploading file...</p> : null}
        </div>
      </div>
    </section>
  )
}
