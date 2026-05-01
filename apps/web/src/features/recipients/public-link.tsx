import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../shared/api/client.ts'
import { StatusView } from '../../shared/ui/components.tsx'
import { saveResponseAsDownload } from '../../shared/files/transfer.ts'

export function PublicLinkPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<'starting' | 'done' | 'invalid'>('starting')

  useEffect(() => {
    let cancelled = false

    async function startDownload() {
      try {
        const response = await api.downloadPublicLink(token)
        if (cancelled) {
          return
        }

        await saveResponseAsDownload(response, 'liminalis-download.bin')
        setState('done')
      } catch {
        if (!cancelled) {
          setState('invalid')
        }
      }
    }

    void startDownload()
    return () => {
      cancelled = true
    }
  }, [token])

  if (state === 'invalid') {
    return (
      <main className="entry-screen">
        <StatusView title="Link unavailable" detail="This download link cannot be used." tone="danger" />
      </main>
    )
  }

  return (
    <main className="entry-screen">
      <StatusView
        title={state === 'done' ? 'Download started' : 'Starting download'}
        detail={state === 'done' ? 'You can close this page after the browser begins saving the file.' : 'Liminalis is preparing the file without showing sender metadata.'}
      />
    </main>
  )
}
