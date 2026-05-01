import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useMemo, useRef, useState } from 'react'
import { api, type ConfidentialityLevel, type TimelineItem } from '../../shared/api/client.ts'
import { Button, EmptyState, IconButton, TextArea, Toast } from '../../shared/ui/components.tsx'
import { confidentialityClass, formatDateTime, formatShortDate } from '../../shared/ui/format.ts'
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

function nextLevel(current: ConfidentialityLevel) {
  const index = confidentialityOptions.indexOf(current)
  return confidentialityOptions[(index + 1) % confidentialityOptions.length] ?? 'SECRET'
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

              return (
                <article key={item.id} className={item.sourceObjectType === 'SOURCE_ITEM' ? 'timeline-item own' : 'timeline-item incoming'}>
                  <div className="timeline-card">
                    <header>
                      <div>
                        <strong>{item.sourceLabel}</strong>
                        <span>{formatDateTime(item.createdTime)}</span>
                      </div>
                      <span className={`level-pill ${confidentialityClass(item.confidentialityLevel)}`}>
                        {item.confidentialityLevel.replace('_', ' ')}
                      </span>
                    </header>
                    {isText ? (
                      <p className="timeline-text">{item.visibleSummary ?? item.displayTitle ?? 'Text item'}</p>
                    ) : (
                      <button className="file-tile" type="button" onClick={() => download.mutate(item)} disabled={download.isPending}>
                        <span className="file-kind">{item.groupedItemCount ? 'Group' : 'File'}</span>
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
                  </div>
                  <div className="timeline-actions">
                    {ids.sourceItemId && !isText ? (
                      <Link className="icon-link" to={`/app/share/${ids.sourceItemId}`} title="Share item" aria-label="Share item">
                        ↗
                      </Link>
                    ) : null}
                    <Link className="icon-link" to={`/app/items/${ids.sourceItemId ?? ids.shareObjectId ?? item.sourceObjectId}`} title="Details" aria-label="Details">
                      i
                    </Link>
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
        <IconButton label={`Confidentiality: ${level}`} onClick={() => setLevel((current) => nextLevel(current))}>
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
