import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, decodeResponseJsonHeader } from '../../shared/api/client.ts'
import {
  decryptSourceMetadataWithKey,
  sourceKeyFromPublicLinkEnvelope,
  type SourceKeyEnvelope,
} from '../../shared/crypto/envelope.ts'
import { Button, StatusView } from '../../shared/ui/components.tsx'
import {
  isDownloadRequiresUserActionError,
  isLargeDownloadUnsupportedError,
  saveEncryptedResponseAsDownload,
} from '../../shared/files/transfer.ts'

type DownloadState = 'starting' | 'needs-action' | 'done' | 'invalid' | 'unsupported'
type TokenDownload = { token: string; promise: Promise<void> }

async function runPublicLinkDownload(token: string) {
  const secret = new URLSearchParams(window.location.hash.replace(/^#/u, '')).get('k')
  if (!secret) {
    throw new Error('Public link key is missing.')
  }

  const response = await api.downloadPublicLink(token)
  const packageReference = decodeResponseJsonHeader(response, 'x-liminalis-package') as SourceKeyEnvelope | null
  const encryptedMetadata = decodeResponseJsonHeader(response, 'x-liminalis-encrypted-metadata')
  const contentCryptoMetadata = decodeResponseJsonHeader(response, 'x-liminalis-content-crypto')
  if (!packageReference) {
    throw new Error('Public link package is missing.')
  }

  const sourceKey = await sourceKeyFromPublicLinkEnvelope(packageReference, secret)
  const metadata = encryptedMetadata
    ? await decryptSourceMetadataWithKey(encryptedMetadata, sourceKey).catch(() => null)
    : null
  await saveEncryptedResponseAsDownload({
    response,
    fallbackName: metadata?.displayName ?? 'liminalis-download.bin',
    contentCryptoMetadata,
    sourceKey,
  })
}

function ensureAutoDownload(current: TokenDownload | null, token: string) {
  if (current?.token === token) {
    return current
  }

  return {
    token,
    promise: runPublicLinkDownload(token),
  }
}

function stateForToken(state: { token: string; state: DownloadState }, token: string) {
  return token === '' ? 'invalid' : state.token === token ? state.state : 'starting'
}

function stateFromDownloadError(error: unknown): DownloadState {
  if (isDownloadRequiresUserActionError(error)) {
    return 'needs-action'
  }

  if (isLargeDownloadUnsupportedError(error)) {
    return 'unsupported'
  }

  return 'invalid'
}

export function PublicLinkPage() {
  const { token = '' } = useParams()
  const autoDownloadRef = useRef<TokenDownload | null>(null)
  const [state, setState] = useState<{ token: string; state: DownloadState }>({ token: '', state: 'starting' })
  const visibleState = stateForToken(state, token)

  useEffect(() => {
    if (!token) {
      return
    }

    const download = ensureAutoDownload(autoDownloadRef.current, token)
    autoDownloadRef.current = download
    let active = true

    download.promise
      .then(() => {
        if (active) {
          setState({ token, state: 'done' })
        }
      })
      .catch((error) => {
        if (active) {
          setState({ token, state: stateFromDownloadError(error) })
        }
      })

    return () => {
      active = false
    }
  }, [token])

  function startManualDownload() {
    if (!token || visibleState === 'starting') {
      return
    }

    setState({ token, state: 'starting' })
    runPublicLinkDownload(token)
      .then(() => setState({ token, state: 'done' }))
      .catch((error) => setState({ token, state: stateFromDownloadError(error) }))
  }

  if (visibleState === 'invalid') {
    return (
      <main className="entry-screen">
        <StatusView title="Link unavailable" detail="This download link cannot be used." tone="danger" />
      </main>
    )
  }

  if (visibleState === 'unsupported') {
    return (
      <main className="entry-screen">
        <StatusView
          title="Browser cannot save this file"
          detail="This large encrypted download needs stream-save support. Use a Chromium-based desktop browser for this link."
          tone="danger"
        />
      </main>
    )
  }

  if (visibleState === 'needs-action') {
    return (
      <main className="entry-screen">
        <StatusView
          title="Ready to save"
          detail="This large encrypted file needs a save dialog before Liminalis can stream it to disk."
          actions={<Button variant="primary" onClick={startManualDownload}>Save file</Button>}
        />
      </main>
    )
  }

  return (
    <main className="entry-screen">
      <StatusView
        title={visibleState === 'done' ? 'Download started' : 'Starting download'}
        detail={visibleState === 'done' ? 'You can close this page after the browser begins saving the file.' : 'Liminalis is preparing the file without showing sender metadata.'}
      />
    </main>
  )
}
