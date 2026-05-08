function sanitizeQuotedFilename(fileName: string, fallback: string) {
  const cleaned = fileName
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '_')
    .replace(/[\\/"';]/g, '_')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  return cleaned || fallback;
}

function encodeRfc5987Value(fileName: string, fallback: string) {
  const normalized = fileName
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '_')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 180);

  return encodeURIComponent(normalized || fallback)
    .replace(/['()]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/\*/g, '%2A');
}

export function attachmentDisposition(
  fileName: string | null | undefined,
  fallback = 'liminalis-download.bin',
) {
  const inputFileName = fileName ?? '';
  const safeFileName = sanitizeQuotedFilename(inputFileName, fallback);
  const encodedFileName = encodeRfc5987Value(inputFileName, fallback);

  return `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`;
}
