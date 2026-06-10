/**
 * Normalizes any Drive image URL to the internal proxy endpoint.
 *
 * Handles:
 *   https://drive.google.com/uc?export=view&id=FILE_ID
 *   https://drive.google.com/file/d/FILE_ID/view
 *   https://lh3.googleusercontent.com/d/FILE_ID
 *
 * Blob/data URLs are returned unchanged.
 * Non-Drive URLs are returned unchanged.
 * Null/undefined input returns null.
 */
export function normalizeDriveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('data:')) return url

  // Already a proxy URL — return as-is
  if (url.startsWith('/api/proxy/image/')) return url

  // Extract fileId from lh3 URLs
  if (url.includes('lh3.googleusercontent.com/d/')) {
    const m = url.match(/\/d\/([^/?=]+)/)
    return m ? `/api/proxy/image/${m[1]}` : url
  }

  // Any other Drive URL — /d/FILE_ID/view  or  ?id=FILE_ID
  const match = url.match(/\/d\/([^/?=]+)/) ?? url.match(/[?&]id=([^&]+)/)
  const fileId = match?.[1]
  if (!fileId) return url
  return `/api/proxy/image/${fileId}`
}
