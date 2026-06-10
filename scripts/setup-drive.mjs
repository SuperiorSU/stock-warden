/**
 * One-time Drive setup script.
 * Run: node --env-file=.env scripts/setup-drive.mjs
 *
 * Does exactly three things:
 *  1. Creates a folder named "stockwarden" (owned by service account)
 *  2. Shares it with DRIVE_ADMIN_EMAIL as writer
 *  3. Removes DRIVE_REMOVE_EMAIL from the folder's permission list
 *
 * After running, copy the printed FOLDER_ID into .env as GOOGLE_DRIVE_FOLDER_ID.
 */

import { google } from 'googleapis'

// ─── Config ──────────────────────────────────────────────────────────────────

const CLIENT_EMAIL  = process.env.GOOGLE_DRIVE_CLIENT_EMAIL
const PRIVATE_KEY   = (process.env.GOOGLE_DRIVE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
const ADMIN_EMAIL   = process.env.DRIVE_ADMIN_EMAIL
const REMOVE_EMAIL  = process.env.DRIVE_REMOVE_EMAIL

const MISSING = []
if (!CLIENT_EMAIL)  MISSING.push('GOOGLE_DRIVE_CLIENT_EMAIL')
if (!PRIVATE_KEY)   MISSING.push('GOOGLE_DRIVE_PRIVATE_KEY')
if (!ADMIN_EMAIL || ADMIN_EMAIL.startsWith('REPLACE'))  MISSING.push('DRIVE_ADMIN_EMAIL')

if (MISSING.length) {
  console.error('Missing or unset env vars:', MISSING.join(', '))
  process.exit(1)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const auth = new google.auth.JWT({
  email:  CLIENT_EMAIL,
  key:    PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/drive'],
})

const drive = google.drive({ version: 'v3', auth })

// ─── Step 1: Create folder ───────────────────────────────────────────────────

console.log('\n[1/3] Creating folder "stockwarden"...')

const folderRes = await drive.files.create({
  requestBody: {
    name:     'stockwarden',
    mimeType: 'application/vnd.google-apps.folder',
  },
  fields: 'id, name',
})

const folderId = folderRes.data.id
console.log(`      Created: ${folderRes.data.name} (id: ${folderId})`)

// ─── Step 2: Share with admin ─────────────────────────────────────────────────

console.log(`\n[2/3] Sharing with ${ADMIN_EMAIL} as writer...`)

await drive.permissions.create({
  fileId: folderId,
  requestBody: {
    type:         'user',
    role:         'writer',
    emailAddress: ADMIN_EMAIL,
  },
  fields:                    'id',
  sendNotificationEmail:     false,
})

console.log(`      Done — ${ADMIN_EMAIL} can now create files in the folder.`)

// ─── Step 3: Remove sviet_web access ─────────────────────────────────────────

if (!REMOVE_EMAIL || REMOVE_EMAIL.startsWith('REPLACE')) {
  console.log('\n[3/3] DRIVE_REMOVE_EMAIL not set — skipping permission removal.')
} else {
  console.log(`\n[3/3] Looking for ${REMOVE_EMAIL} in folder permissions...`)

  const permList = await drive.permissions.list({
    fileId: folderId,
    fields: 'permissions(id, emailAddress, role)',
  })

  const target = (permList.data.permissions ?? []).find(
    (p) => p.emailAddress?.toLowerCase() === REMOVE_EMAIL.toLowerCase()
  )

  if (!target) {
    console.log(`      ${REMOVE_EMAIL} has no permission on this folder — nothing to remove.`)
  } else {
    await drive.permissions.delete({
      fileId:       folderId,
      permissionId: target.id,
    })
    console.log(`      Removed ${REMOVE_EMAIL} (was: ${target.role}).`)
  }
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────')
console.log(' Setup complete.')
console.log(` Folder ID: ${folderId}`)
console.log(' Update your .env:')
console.log(`   GOOGLE_DRIVE_FOLDER_ID="${folderId}"`)
console.log('─────────────────────────────────────────────\n')
