import type { ConfidentialityLevel } from '../api/client.ts'

export function formatDateTime(input: string | null | undefined) {
  if (!input) {
    return 'No expiry'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input))
}

export function formatShortDate(input: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(input))
}

export function humanEnum(input: string | null | undefined, fallback = 'Unknown') {
  if (!input) {
    return fallback
  }

  return input
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function confidentialityLabel(level: ConfidentialityLevel) {
  if (level === 'TOP_SECRET') {
    return 'Top secret'
  }

  return humanEnum(level, level)
}

export function confidentialityClass(level: ConfidentialityLevel) {
  return `level-${level.toLowerCase().replace('_', '-')}`
}

export function validityTone(validUntil: string | null | undefined) {
  if (!validUntil) {
    return 'steady'
  }

  const diff = new Date(validUntil).getTime() - Date.now()
  if (!Number.isFinite(diff) || diff <= 0) {
    return 'urgent'
  }

  if (diff <= 30 * 60 * 1000) {
    return 'warning'
  }

  return 'steady'
}

export function minutesToLabel(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined || minutes === 0) {
    return 'No expiry'
  }

  if (minutes % 1440 === 0) {
    return `${minutes / 1440} day${minutes / 1440 === 1 ? '' : 's'}`
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} hour${minutes / 60 === 1 ? '' : 's'}`
  }

  return `${minutes} minutes`
}
