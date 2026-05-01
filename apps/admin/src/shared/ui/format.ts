export function formatBytes(bytes: number) {
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

export function formatDate(input: string | null | undefined) {
  if (!input) {
    return 'Never'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input))
}
