// app/api/health/drive/route.ts
import { verifyDriveFolderAccess } from '@/lib/storage/drive'

export async function GET() {
  const scriptUrl    = process.env.APPS_SCRIPT_UPLOAD_URL
  const scriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET

  if (!scriptUrl || !scriptSecret) {
    return Response.json({
      status: 'error',
      drive: false,
      script: false,
      message: 'APPS_SCRIPT_UPLOAD_URL or GOOGLE_APPS_SCRIPT_SECRET not set',
    }, { status: 500 })
  }

  // The deployed Apps Script has no doGet — check config presence only
  const scriptConfigured =
    scriptUrl.includes('script.google.com') &&
    scriptSecret.length > 0 &&
    !scriptSecret.startsWith('#REPLACE')

  const driveAccessible = await verifyDriveFolderAccess()
  const allOk = scriptConfigured && driveAccessible

  return Response.json({
    status: allOk ? 'ok' : 'degraded',
    script: scriptConfigured,
    // Redact deployment ID from URL in response
    scriptUrl: scriptUrl.replace(/\/s\/[^/]+\//, '/s/[REDACTED]/'),
    drive: driveAccessible,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  }, { status: allOk ? 200 : 503 })
}
