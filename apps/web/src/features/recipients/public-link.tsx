import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, decodeResponseJsonHeader } from '../../shared/api/client.ts'
import {
  decryptFilePayloadWithKey,
  decryptSourceMetadataWithKey,
  sourceKeyFromPublicLinkEnvelope,
  type SourceKeyEnvelope,
} from '../../shared/crypto/envelope.ts'
import { StatusView } from '../../shared/ui/components.tsx'
import { saveBlobAsDownload } from '../../shared/files/transfer.ts'

type DownloadState = 'starting' | 'done' | 'invalid'
type TokenDownload = { token: string; promise: Promise<void> }

function ensureDownload(current: TokenDownload | null, token: string) {
  if (current?.token === token) {
    return current
  }

  return {
    token,
    promise: (async () => {
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
      const decrypted = await decryptFilePayloadWithKey(await response.blob(), contentCryptoMetadata, sourceKey)
      saveBlobAsDownload(decrypted, metadata?.displayName ?? 'liminalis-download.bin')
    })(),
  }
}

function stateForToken(state: { token: string; state: DownloadState }, token: string) {
  return token === '' ? 'invalid' : state.token === token ? state.state : 'starting'
}

export function PublicLinkPage() {
  const { token = '' } = useParams()
  const downloadRef = useRef<TokenDownload | null>(null)
  const [state, setState] = useState<{ token: string; state: DownloadState }>({ token: '', state: 'starting' })
  const visibleState = stateForToken(state, token)

  useEffect(() => {
    if (!token) {
      return
    }

    const download = ensureDownload(downloadRef.current, token)
    downloadRef.current = download
    let active = true

    download.promise
      .then(() => {
        if (active) {
          setState({ token, state: 'done' })
        }
      })
      .catch(() => {
        if (active) {
          setState({ token, state: 'invalid' })
        }
      })

    return () => {
      active = false
    }
  }, [token])

  if (visibleState === 'invalid') {
    return (
      <main className="entry-screen">
        <StatusView title="Link unavailable" detail="This download link cannot be used." tone="danger" />
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
