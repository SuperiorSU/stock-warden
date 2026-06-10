// lib/storage/drive.ts
// Upload proxy: Apps Script (runs as admin, uses org quota)
// Folder ops:   Service account (no quota needed for metadata ops)

import { google } from 'googleapis'
import { Readable } from 'stream'

// ─── Service Account Client (folder ops only) ────────────────────────────────

function getServiceAccountClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL!,
    key: process.env.GOOGLE_DRIVE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export function getDriveClient() {
  return google.drive({ version: 'v3', auth: getServiceAccountClient() })
}

// ─── Retained: stream + download URL (still uses service account) ─────────────

export async function getDriveDownloadUrl(fileId: string) {
  const drive = getDriveClient()
  const response = await drive.files.get({
    fileId,
    fields: 'webContentLink,webViewLink',
    supportsAllDrives: true,
  })
  return (
    response.data.webContentLink ??
    response.data.webViewLink ??
    `https://drive.google.com/uc?id=${fileId}&export=download`
  )
}

export async function streamFileFromDrive(fileId: string) {
  const drive = getDriveClient()
  const meta = await drive.files.get({ fileId, fields: 'name,mimeType', supportsAllDrives: true })
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  )
  const nodeStream: Readable = res.data as Readable
  return {
    stream: nodeStream,
    name: meta.data.name ?? 'file',
    mimeType: meta.data.mimeType ?? 'application/octet-stream',
  }
}

// ─── Apps Script Proxy (upload only) ─────────────────────────────────────────
// Script endpoint: APPS_SCRIPT_UPLOAD_URL
// Script reads:    JSON.parse(e.postData.contents)
// Script expects:  { secret, folderId, fileBase64, mimeType, fileName }
// Script returns:  { success, fileId, viewUrl, downloadUrl } | { success, message }

const SCRIPT_URL    = process.env.APPS_SCRIPT_UPLOAD_URL!
const SCRIPT_SECRET = process.env.GOOGLE_APPS_SCRIPT_SECRET!

interface ScriptUploadResponse {
  success: boolean
  fileId?: string
  viewUrl?: string      // file.getUrl() — Drive viewer page, not img-friendly
  downloadUrl?: string
  message?: string      // error description
}

/**
 * Upload an image file to Drive via the Apps Script proxy.
 * The proxy runs as the admin account — uses org storage quota.
 * Returns the public view URL stored in InventoryItem.imageUrl.
 */
export async function uploadItemImageToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  // NOTE: never log this body — it contains the full base64 image payload
  const body = JSON.stringify({
    secret:     SCRIPT_SECRET,
    folderId:   process.env.GOOGLE_DRIVE_FOLDER_ID!,
    fileBase64: buffer.toString('base64'),
    fileName:   fileName,
    mimeType:   mimeType,
  })

  const response = await fetch(SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    body,
    // Apps Script has cold-start delay — 30s timeout
    signal:  AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    throw new Error(`Apps Script proxy returned HTTP ${response.status}`)
  }

  const result: ScriptUploadResponse = await response.json()

  if (!result.success || !result.fileId) {
    throw new Error(`Upload failed: ${result.message ?? 'Unknown error from proxy'}`)
  }

  // direct CDN URL — no redirect, no session binding
  return `https://lh3.googleusercontent.com/d/${result.fileId}=w1000`
}

/**
 * Delete a file from Drive.
 * NOTE: The deployed Apps Script has no delete handler.
 * This is a no-op — orphaned files must be cleaned up manually in Drive.
 */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  console.warn('[Drive] deleteFileFromDrive: script has no delete endpoint — skipping. fileId:', fileId)
}

/**
 * Extract fileId from a Drive URL.
 * Handles both formats:
 *   https://drive.google.com/uc?export=view&id=FILE_ID
 *   https://drive.google.com/file/d/FILE_ID/view
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null
  // https://lh3.googleusercontent.com/d/FILE_ID=w1000  (stop before = size specifier)
  const lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([^/?=]+)/)
  if (lh3Match) return lh3Match[1]
  // https://drive.google.com/uc?export=view&id=FILE_ID
  const qMatch = url.match(/[?&]id=([^&]+)/)
  if (qMatch) return qMatch[1]
  // https://drive.google.com/file/d/FILE_ID/view
  const dMatch = url.match(/\/file\/d\/([^/]+)/)
  return dMatch ? dMatch[1] : null
}

/**
 * Ensure the upload folder exists and is accessible.
 * Uses service account — folder metadata ops need no quota.
 */
export async function verifyDriveFolderAccess(): Promise<boolean> {
  try {
    const drive = getDriveClient()
    await drive.files.get({
      fileId: process.env.GOOGLE_DRIVE_FOLDER_ID!,
      fields: 'id, name',
    })
    return true
  } catch {
    return false
  }
}
