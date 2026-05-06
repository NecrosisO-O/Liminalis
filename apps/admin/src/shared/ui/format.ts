export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`
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
