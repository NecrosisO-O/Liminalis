import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMemo, useRef, useState } from 'react'
import { api, type ConfidentialityLevel, type TimelineItem } from '../../shared/api/client.ts'
import { Button, EmptyState, IconButton, TextArea, Toast } from '../../shared/ui/components.tsx'
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
const collapsedTextLimit = 420

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

export function TimelinePage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [level, setLevel] = useState<ConfidentialityLevel>('SECRET')
  const [text, setText] = useState('')
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState<{ tone: 'success' | 'danger' | 'warning'; message: string } | null>(null)

  const timeline = useQuery({
    queryKey: ['timeline'],
    queryFn: api.getTimeline,
  })

  const groups = useMemo(() => groupTimeline(timeline.data ?? []), [timeline.data])

  const sendText = useMutation({
    mutationFn: () => uploadTextItem(text.trim(), { confidentialityLevel: level }),
    onSuccess: async () => {
      setText('')
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
      <div className="timeline-stream">
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
              const textBody = item.visibleSummary ?? item.displayTitle ?? 'Text item'
              const isLongText = isText && textBody.length > collapsedTextLimit
              const isExpanded = expandedTextIds.has(item.id)

              return (
                <article
                  key={item.id}
                  className={`timeline-item ${item.timelineOrigin === 'CURRENT_DEVICE' ? 'outgoing' : 'incoming'} origin-${timelineOriginClass(item)}`}
                >
                  <div className="timeline-avatar" aria-hidden="true">{avatarLabel(item.sourceLabel)}</div>
                  <div className="timeline-content">
                    <div className="timeline-meta">{timelineMeta(item)}</div>
                    <div className={`timeline-card ${isText ? `timeline-card-text ${confidentialityClass(item.confidentialityLevel)}` : 'timeline-card-file'}`}>
                      {isText ? (
                        <>
                          <p className={`timeline-text ${isLongText && !isExpanded ? 'is-collapsed' : ''}`}>{textBody}</p>
                          {isLongText ? (
                            <button
                              className="text-toggle"
                              type="button"
                              onClick={() => {
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
                            >
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <button className="file-tile" type="button" onClick={() => download.mutate(item)} disabled={download.isPending}>
                          <span className={`file-kind ${confidentialityClass(item.confidentialityLevel)}`} aria-hidden="true">
                            {item.groupedItemCount ? 'G' : 'F'}
                          </span>
                          <span>
                            <strong>{itemTitle(item)}</strong>
                            <small>
                              {item.visibleTypeLabel}
                              {item.visibleSizeBytes ? ` · ${formatBytes(item.visibleSizeBytes)}` : ''}
                              {item.groupedItemCount ? ` · ${item.groupedItemCount} items` : ''}
                            </small>
                          </span>
                        </button>
                      )}
                      {ids.sourceItemId && !isText ? (
                        <div className="timeline-actions">
                          <Link className="timeline-action-link share-action" to={`/app/share/${ids.sourceItemId}`} title="Share item" aria-label="Share item">
                            Share
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        ))}
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
        <TextArea value={text} onChange={(event) => setText(event.target.value)} rows={1} placeholder="Send text to yourself" />
        {text.trim() ? (
          <Button variant="primary" type="submit" disabled={sendText.isPending}>
            Send
          </Button>
        ) : (
          <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={sendFile.isPending}>
            Attach
          </Button>
        )}
      </form>
    </section>
  )
}
