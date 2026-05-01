import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type ConfidentialityLevel, type LiveTransferSession } from '../../shared/api/client.ts'
import { Button, EmptyState, Field, SelectInput, TextInput, Toast } from '../../shared/ui/components.tsx'
import {
  classifySelection,
  collectDroppedFiles,
  entriesFromFileList,
  formatBytes,
  prepareTransferPayload,
  saveBlobAsDownload,
  uploadBlobParts,
  type DirectoryInputProps,
  type SelectedFileEntry,
} from '../../shared/files/transfer.ts'
import { formatDateTime } from '../../shared/ui/format.ts'

const confidentialityOptions: ConfidentialityLevel[] = ['SECRET', 'CONFIDENTIAL', 'TOP_SECRET']
const relayChunkBytes = 512 * 1024
const p2pChunkBytes = 64 * 1024

type LivePayloadManifest = {
  fileName: string
  byteSize: number
  contentType: string
}

type ReceivedRelayChunk = {
  sequence: number
  blob: Blob
}

function sessionId(session: LiveTransferSession | undefined) {
  return session?.id ?? session?.liveTransferSessionId ?? ''
}

function storeLiveSelection(id: string, entries: SelectedFileEntry[]) {
  ;(globalThis as unknown as { __liminalisLiveSelections?: Map<string, SelectedFileEntry[]> }).__liminalisLiveSelections ??= new Map()
  ;(globalThis as unknown as { __liminalisLiveSelections: Map<string, SelectedFileEntry[]> }).__liminalisLiveSelections.set(id, entries)
  sessionStorage.setItem(`live-files:${id}`, JSON.stringify(entries.map((entry) => entry.path)))
}

function loadLiveSelection(id: string) {
  return (globalThis as unknown as { __liminalisLiveSelections?: Map<string, SelectedFileEntry[]> }).__liminalisLiveSelections?.get(id) ?? []
}

function activeTransport(session: LiveTransferSession | undefined) {
  return session?.transportState
}

function canExchangeLiveData(session: LiveTransferSession | undefined) {
  return Boolean(session?.initiatorConfirmedAt && session.joinerConfirmedAt && (session.state === 'CONNECTING' || session.state === 'ACTIVE'))
}

function isReadyForRelay(session: LiveTransferSession | undefined) {
  return canExchangeLiveData(session) && activeTransport(session) === 'RELAY_ACTIVE'
}

function orderedChunks(chunks: Blob[]) {
  return new Blob(chunks)
}

export function LiveStartPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [entries, setEntries] = useState<SelectedFileEntry[]>([])
  const [level, setLevel] = useState<ConfidentialityLevel>('SECRET')
  const [label, setLabel] = useState('')
  const selection = useMemo(() => classifySelection(entries), [entries])

  const create = useMutation({
    mutationFn: () => {
      if (!selection) {
        throw new Error('Choose files before starting a live transfer.')
      }

      return api.createLiveTransferSession({
        contentLabel: label.trim() || selection.displayName,
        contentKind: selection.contentKind,
        groupedTransfer: selection.contentKind === 'GROUPED_CONTENT',
        confidentialityLevel: level,
      })
    },
    onSuccess: (session) => {
      storeLiveSelection(sessionId(session), entries)
      navigate(`/live/${sessionId(session)}`, { replace: true })
    },
  })

  return (
    <section className="workspace-page live-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Live transfer</p>
          <h2>Start a direct file session</h2>
        </div>
        <Link className="button button-secondary" to="/app">Back to workspace</Link>
      </header>
      <input ref={fileInputRef} hidden type="file" multiple onChange={(event) => setEntries(entriesFromFileList(event.target.files))} />
      <input
        ref={folderInputRef}
        {...({ webkitdirectory: '', directory: '' } satisfies DirectoryInputProps)}
        hidden
        type="file"
        multiple
        onChange={(event) => setEntries(entriesFromFileList(event.target.files))}
      />
      <section
        className="dropzone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault()
          setEntries(await collectDroppedFiles(event.dataTransfer))
        }}
        role="button"
        tabIndex={0}
      >
        <strong>{selection ? selection.displayName : 'Choose live-transfer files'}</strong>
        <span>{selection ? `${selection.entries.length} files · ${formatBytes(selection.totalBytes)}` : 'Files, folders, and grouped content are accepted.'}</span>
        <div className="actions">
          <Button type="button" onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click() }}>Files</Button>
          <Button type="button" onClick={(event) => { event.stopPropagation(); folderInputRef.current?.click() }}>Folder</Button>
        </div>
      </section>
      <section className="action-panel">
        <Field label="Label">
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} placeholder={selection?.displayName ?? 'Live transfer'} />
        </Field>
        <Field label="Confidentiality">
          <SelectInput value={level} onChange={(event) => setLevel(event.target.value as ConfidentialityLevel)}>
            {confidentialityOptions.map((option) => <option key={option}>{option}</option>)}
          </SelectInput>
        </Field>
        {create.error instanceof Error ? <p className="field-error">{create.error.message}</p> : null}
        <Button variant="primary" disabled={!selection || create.isPending} onClick={() => create.mutate()}>
          Start session
        </Button>
      </section>
    </section>
  )
}

export function LiveJoinPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const join = useMutation({
    mutationFn: () => api.joinLiveTransferSession(code.trim()),
    onSuccess: (session) => navigate(`/live/${sessionId(session)}`, { replace: true }),
  })

  return (
    <section className="workspace-page live-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Live transfer</p>
          <h2>Join by code</h2>
        </div>
      </header>
      <section className="action-panel">
        <Field label="Session code" error={join.error instanceof Error ? join.error.message : null}>
          <TextInput value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Button variant="primary" disabled={!code.trim() || join.isPending} onClick={() => join.mutate()}>
          Join session
        </Button>
      </section>
    </section>
  )
}

export function LiveSessionPage() {
  const { sessionId: routeSessionId = '' } = useParams()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ tone: 'success' | 'danger' | 'warning'; message: string } | null>(null)
  const [p2pState, setP2pState] = useState('idle')
  const [localEntries, setLocalEntries] = useState<SelectedFileEntry[]>(() => loadLiveSelection(routeSessionId))
  const [relayProgress, setRelayProgress] = useState<{ sent: number; total: number } | null>(null)
  const [p2pReady, setP2pReady] = useState(false)
  const [receivedRelayChunks, setReceivedRelayChunks] = useState<Record<string, ReceivedRelayChunk>>({})
  const [receivedP2p, setReceivedP2p] = useState<{
    manifest: LivePayloadManifest | null
    chunks: Blob[]
    receivedBytes: number
  }>({ manifest: null, chunks: [], receivedBytes: 0 })
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const channelRef = useRef<RTCDataChannel | null>(null)
  const handledSignalIdsRef = useRef(new Set<string>())

  const session = useQuery({
    queryKey: ['live', routeSessionId],
    queryFn: () => api.getLiveTransferSession(routeSessionId),
    enabled: routeSessionId !== '',
    refetchInterval: 2000,
  })

  const confirm = useMutation({
    mutationFn: () => api.confirmLiveTransferSession(routeSessionId, true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['live', routeSessionId] })
    },
  })

  const relay = useMutation({
    mutationFn: async () => {
      if (!isReadyForRelay(session.data)) {
        throw new Error('Confirm both sides and activate relay before sending.')
      }

      const payload = await buildCurrentLivePayload(localEntries)
      let sequence = 1
      setRelayProgress({ sent: 0, total: payload.blob.size })

      await api.uploadLiveRelayChunk(
        routeSessionId,
        sequence,
        new Blob([JSON.stringify({
          kind: 'liminalis-live-manifest-v1',
          fileName: payload.displayName,
          byteSize: payload.blob.size,
          contentType: payload.blob.type || 'application/octet-stream',
        })], { type: 'application/json' }),
      )
      sequence += 1

      let sent = 0
      for (let offset = 0; offset < payload.blob.size; offset += relayChunkBytes) {
        const chunk = payload.blob.slice(offset, offset + relayChunkBytes)
        await api.uploadLiveRelayChunk(routeSessionId, sequence, chunk)
        sent += chunk.size
        setRelayProgress({ sent, total: payload.blob.size })
        sequence += 1
      }

      await api.completeLiveTransferSession(routeSessionId).catch(() => undefined)
      setToast({ tone: 'success', message: `Relay payload sent as ${payload.displayName}.` })
    },
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Relay upload failed.' }),
  })

  const chunks = useQuery({
    queryKey: ['live', routeSessionId, 'relay-chunks'],
    queryFn: () => api.listLiveRelayChunks(routeSessionId),
    enabled: routeSessionId !== '',
    refetchInterval: 2500,
  })

  const signals = useQuery({
    queryKey: ['live', routeSessionId, 'signals'],
    queryFn: () => api.listLiveSignals(routeSessionId),
    enabled: routeSessionId !== '' && canExchangeLiveData(session.data),
    refetchInterval: 1200,
  })

  const chooseLocalFiles = useMutation({
    mutationFn: pickFiles,
    onSuccess: (files) => {
      const entries = entriesFromFileList(files)
      setLocalEntries(entries)
      storeLiveSelection(routeSessionId, entries)
    },
  })

  const activateRelay = useMutation({
    mutationFn: async () => {
      await api.updateLiveTransferTransport(routeSessionId, 'RELAY_ACTIVE')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['live', routeSessionId] })
      setToast({ tone: 'success', message: 'Relay transport is active.' })
    },
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not activate relay.' }),
  })

  const fail = useMutation({
    mutationFn: () => api.failLiveTransferSession(routeSessionId, 'cancelled from browser'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['live', routeSessionId] })
    },
  })

  const storedFallback = useMutation({
    mutationFn: async () => {
      if (localEntries.length === 0) {
        throw new Error('Choose the files on this browser before using stored fallback.')
      }

      const failed = await api.failLiveTransferSession(routeSessionId, 'stored fallback requested')
      if (!failed.liveToStoredFallbackAllowed) {
        throw new Error('Stored fallback is not allowed for this session.')
      }

      const prepared = await api.beginLiveStoredFallback(routeSessionId)
      const payload = await buildCurrentLivePayload(localEntries)
      await uploadBlobParts(prepared.uploadSessionId, payload.blob, payload.displayName)
      await api.finalizeUpload(prepared.uploadSessionId, {
        displayName: payload.displayName,
        manifest: payload.manifest,
      })
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['live', routeSessionId] })
      return payload.displayName
    },
    onSuccess: (name) => setToast({ tone: 'success', message: `Stored fallback created for ${name}.` }),
    onError: (error) => setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Stored fallback failed.' }),
  })

  const handleP2pMessage = useCallback((data: unknown) => {
    if (typeof data === 'string') {
      const parsed = JSON.parse(data) as { kind?: string } & Partial<LivePayloadManifest>
      if (parsed.kind === 'liminalis-live-manifest-v1') {
        setReceivedP2p({
          manifest: {
            fileName: parsed.fileName ?? 'live-transfer.bin',
            byteSize: parsed.byteSize ?? 0,
            contentType: parsed.contentType ?? 'application/octet-stream',
          },
          chunks: [],
          receivedBytes: 0,
        })
      } else if (parsed.kind === 'liminalis-live-complete-v1') {
        setToast({ tone: 'success', message: 'P2P payload received.' })
        void api.completeLiveTransferSession(routeSessionId).catch(() => undefined)
      }
      return
    }

    const blob = data instanceof Blob ? data : new Blob([data as BlobPart])
    setReceivedP2p((current) => ({
      ...current,
      chunks: [...current.chunks, blob],
      receivedBytes: current.receivedBytes + blob.size,
    }))
  }, [routeSessionId])

  const wireDataChannel = useCallback((channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer'
    channel.onopen = () => {
      setP2pState('data channel open')
      setP2pReady(true)
      void api.updateLiveTransferTransport(routeSessionId, 'P2P_ACTIVE').catch(() => undefined)
    }
    channel.onclose = () => {
      setP2pState('data channel closed')
      setP2pReady(false)
    }
    channel.onmessage = (event) => {
      handleP2pMessage(event.data)
    }
  }, [handleP2pMessage, routeSessionId])

  const createPeerConnection = useCallback(() => {
    const peer = new RTCPeerConnection()
    peerRef.current = peer
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        void api.sendLiveSignal(routeSessionId, 'ice-candidate', event.candidate.toJSON() as Record<string, unknown>)
      }
    }
    peer.ondatachannel = (event) => {
      channelRef.current = event.channel
      wireDataChannel(event.channel)
    }

    return peer
  }, [routeSessionId, wireDataChannel])

  async function startP2p() {
    try {
      if (!canExchangeLiveData(session.data)) {
        throw new Error('Both sides must confirm before P2P signaling.')
      }

      setP2pState('creating offer')
      const peer = createPeerConnection()
      const channel = peer.createDataChannel('liminalis-files')
      peerRef.current = peer
      channelRef.current = channel
      wireDataChannel(channel)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await api.sendLiveSignal(routeSessionId, 'offer', { type: offer.type, sdp: offer.sdp ?? '' })
      await api.updateLiveTransferTransport(routeSessionId, 'P2P_ATTEMPT')
      setP2pState('offer sent')
    } catch (error) {
      setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Could not start P2P.' })
    }
  }

  async function sendP2pPayload() {
    try {
      const channel = channelRef.current
      if (!channel || channel.readyState !== 'open') {
        throw new Error('P2P data channel is not open.')
      }

      const payload = await buildCurrentLivePayload(localEntries)
      const manifest: LivePayloadManifest = {
        fileName: payload.displayName,
        byteSize: payload.blob.size,
        contentType: payload.blob.type || 'application/octet-stream',
      }
      channel.send(JSON.stringify({ kind: 'liminalis-live-manifest-v1', ...manifest }))

      for (let offset = 0; offset < payload.blob.size; offset += p2pChunkBytes) {
        const buffer = await payload.blob.slice(offset, offset + p2pChunkBytes).arrayBuffer()
        await waitForChannelBuffer(channel)
        channel.send(buffer)
      }

      channel.send(JSON.stringify({ kind: 'liminalis-live-complete-v1' }))
      await api.completeLiveTransferSession(routeSessionId).catch(() => undefined)
      setToast({ tone: 'success', message: `P2P payload sent as ${payload.displayName}.` })
    } catch (error) {
      setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'P2P send failed.' })
    }
  }

  async function saveP2pPayload() {
    if (!receivedP2p.manifest || receivedP2p.chunks.length === 0) {
      return
    }

    saveBlobAsDownload(
      orderedChunks(receivedP2p.chunks),
      receivedP2p.manifest.fileName,
    )
    await api.completeLiveTransferSession(routeSessionId).catch(() => undefined)
  }

  async function receiveRelayChunk(chunk: { id: string; sequence: number }) {
    const response = await api.downloadLiveRelayChunk(routeSessionId, chunk.id)
    const blob = await response.blob()
    setReceivedRelayChunks((current) => ({ ...current, [chunk.id]: { sequence: chunk.sequence, blob } }))
    await api.acknowledgeLiveRelayChunk(routeSessionId, chunk.id)
    await chunks.refetch()
  }

  async function saveRelayPayload() {
    const downloaded = Object.entries(receivedRelayChunks)
    if (downloaded.length === 0) {
      return
    }

    const manifestEntry = await findRelayManifest(downloaded)
    if (!manifestEntry) {
      saveBlobAsDownload(new Blob(downloaded.sort(([, left], [, right]) => left.sequence - right.sequence).map(([, chunk]) => chunk.blob)), 'liminalis-live-relay.bin')
      return
    }

    const [, manifest] = manifestEntry
    const dataParts = downloaded
      .filter(([id]) => id !== manifestEntry[0])
      .sort(([, left], [, right]) => left.sequence - right.sequence)
      .map(([, chunk]) => chunk.blob)
    saveBlobAsDownload(orderedChunks(dataParts), manifest.fileName)
    await api.completeLiveTransferSession(routeSessionId).catch(() => undefined)
  }

  const activeSession = session.data

  useEffect(() => {
    return () => {
      channelRef.current?.close()
      peerRef.current?.close()
    }
  }, [])

  const handleSignal = useCallback(async (kind: string, payload: Record<string, unknown>) => {
    try {
      if (kind === 'offer') {
        setP2pState('offer received')
        const peer = peerRef.current ?? createPeerConnection()
        await peer.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: String(payload.sdp ?? ''),
        }))
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        await api.sendLiveSignal(routeSessionId, 'answer', { type: answer.type, sdp: answer.sdp ?? '' })
        await api.updateLiveTransferTransport(routeSessionId, 'P2P_ATTEMPT')
        setP2pState('answer sent')
        return
      }

      if (kind === 'answer') {
        const peer = peerRef.current
        if (peer) {
          await peer.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: String(payload.sdp ?? ''),
          }))
          setP2pState('answer received')
        }
        return
      }

      if (kind === 'ice-candidate') {
        const peer = peerRef.current
        if (peer) {
          await peer.addIceCandidate(new RTCIceCandidate(payload))
        }
      }
    } catch (error) {
      setToast({ tone: 'danger', message: error instanceof Error ? error.message : 'Live signaling failed.' })
    }
  }, [createPeerConnection, routeSessionId])

  useEffect(() => {
    for (const signal of signals.data ?? []) {
      if (handledSignalIdsRef.current.has(signal.id)) {
        continue
      }
      handledSignalIdsRef.current.add(signal.id)

      void handleSignal(signal.kind, signal.payload)
    }
  }, [handleSignal, signals.data])

  if (session.isLoading) {
    return <section className="workspace-page"><EmptyState title="Loading live session" /></section>
  }

  if (!activeSession) {
    return <section className="workspace-page"><EmptyState title="Live session not found" /></section>
  }

  return (
    <section className="workspace-page live-page">
      {toast ? <Toast tone={toast.tone}>{toast.message}</Toast> : null}
      <header className="detail-hero">
        <div>
          <p className="eyebrow">Live session</p>
          <h2>{activeSession.contentLabel}</h2>
          <p className="muted">Code {activeSession.sessionCode ?? 'hidden'} · expires {formatDateTime(activeSession.expiresAt)}</p>
        </div>
        <div className="actions">
          <Link className="button button-secondary" to="/live/join">Join another</Link>
          <Link className="button button-secondary" to="/app">Workspace</Link>
        </div>
      </header>
      <section className="detail-grid">
        <LiveMeta label="State" value={activeSession.state} />
        <LiveMeta label="Transport" value={activeSession.transportState ?? 'Pending'} />
        <LiveMeta label="P2P" value={activeSession.peerToPeerAllowed ? p2pState : 'Not allowed'} />
        <LiveMeta label="Relay" value={activeSession.relayAllowed ? 'Allowed' : 'Not allowed'} />
        <LiveMeta label="Stored fallback" value={activeSession.liveToStoredFallbackAllowed ? 'Allowed' : 'Not allowed'} />
      </section>
      <section className="action-panel">
        {localEntries.length > 0 ? (
          <p className="muted">
            Local payload ready: {localEntries.length} file{localEntries.length === 1 ? '' : 's'}.
          </p>
        ) : (
          <p className="muted">Choose files here when this browser is the sender or when using stored fallback.</p>
        )}
        <div className="actions">
          <Button variant="primary" onClick={() => confirm.mutate()} disabled={confirm.isPending}>Confirm participation</Button>
          <Button onClick={() => chooseLocalFiles.mutate()} disabled={chooseLocalFiles.isPending}>Choose files</Button>
          <Button onClick={startP2p} disabled={!activeSession.peerToPeerAllowed || !canExchangeLiveData(activeSession)}>Start P2P</Button>
          <Button onClick={sendP2pPayload} disabled={localEntries.length === 0 || !p2pReady}>Send P2P payload</Button>
          <Button onClick={() => activateRelay.mutate()} disabled={!activeSession.relayAllowed || !canExchangeLiveData(activeSession) || activeTransport(activeSession) === 'RELAY_ACTIVE'}>Activate relay</Button>
          <Button onClick={() => relay.mutate()} disabled={!isReadyForRelay(activeSession) || localEntries.length === 0 || relay.isPending}>Send relay payload</Button>
          <Button onClick={() => storedFallback.mutate()} disabled={!activeSession.liveToStoredFallbackAllowed || localEntries.length === 0 || storedFallback.isPending}>Stored fallback</Button>
          <Button variant="danger" onClick={() => fail.mutate()} disabled={fail.isPending}>Cancel</Button>
        </div>
        {relayProgress ? <p className="muted">Relay sent {formatBytes(relayProgress.sent)} / {formatBytes(relayProgress.total)}</p> : null}
        {storedFallback.error instanceof Error ? <p className="field-error">{storedFallback.error.message}</p> : null}
      </section>
      {receivedP2p.manifest ? (
        <section className="table-panel">
          <h3>P2P payload</h3>
          <div className="file-row">
            <span>{receivedP2p.manifest.fileName} · {formatBytes(receivedP2p.receivedBytes)} / {formatBytes(receivedP2p.manifest.byteSize)}</span>
            <Button onClick={() => void saveP2pPayload()} disabled={receivedP2p.receivedBytes < receivedP2p.manifest.byteSize}>Save</Button>
          </div>
        </section>
      ) : null}
      <section className="table-panel">
        <h3>Relay chunks</h3>
        {chunks.data?.length === 0 ? <p className="muted">No relay chunks yet.</p> : null}
        {chunks.data?.map((chunk) => (
          <div key={chunk.id} className="file-row">
            <span>#{chunk.sequence} · {formatBytes(chunk.byteSize)}</span>
            <Button onClick={() => void receiveRelayChunk(chunk)}>Receive</Button>
          </div>
        ))}
        {Object.keys(receivedRelayChunks).length > 0 ? (
          <div className="file-row">
            <span>{Object.keys(receivedRelayChunks).length} relay chunk{Object.keys(receivedRelayChunks).length === 1 ? '' : 's'} received</span>
            <Button onClick={() => void saveRelayPayload()}>Save relay payload</Button>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function LiveMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function pickFiles() {
  return new Promise<FileList>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        resolve(input.files)
      } else {
        reject(new Error('No files selected.'))
      }
    }
    input.click()
  })
}

async function buildCurrentLivePayload(entries: SelectedFileEntry[]) {
  const selection = classifySelection(entries)
  if (!selection) {
    throw new Error('Choose files before sending.')
  }

  return prepareTransferPayload(selection)
}

function waitForChannelBuffer(channel: RTCDataChannel) {
  if (channel.bufferedAmount < 4 * p2pChunkBytes) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const previous = channel.onbufferedamountlow
    channel.bufferedAmountLowThreshold = 2 * p2pChunkBytes
    channel.onbufferedamountlow = (event) => {
      previous?.call(channel, event)
      resolve()
    }
  })
}

async function findRelayManifest(entries: Array<[string, ReceivedRelayChunk]>): Promise<[string, LivePayloadManifest] | null> {
  for (const [id, chunk] of entries) {
    try {
      const parsed = JSON.parse(await chunk.blob.text()) as { kind?: string } & Partial<LivePayloadManifest>
      if (parsed.kind === 'liminalis-live-manifest-v1') {
        return [
          id,
          {
            fileName: parsed.fileName ?? 'liminalis-live-relay.bin',
            byteSize: parsed.byteSize ?? 0,
            contentType: parsed.contentType ?? 'application/octet-stream',
          },
        ]
      }
    } catch {
      // Data chunks are not JSON manifests.
    }
  }

  return null
}
