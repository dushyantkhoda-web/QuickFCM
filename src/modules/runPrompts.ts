import { input, confirm } from '@inquirer/prompts'
import * as path from 'path'
import { ProjectInfo, UserAnswers, FirebaseWebConfig, BackendConfig } from '../types'
import { logger } from '../utils/logger'
import { writeFile, readFile, fileExists, appendToFile } from '../utils/fileUtils'
import {
  FIREBASE_CONSOLE_URL,
  FIREBASE_MESSAGING_URL,
  FIREBASE_SERVICE_ACCOUNT_URL,
  VAPID_GENERATOR_URL,
  GITIGNORE_FILENAME,
} from '../constants'

async function requiredInput(message: string): Promise<string> {
  let value = ''
  while (!value.trim()) {
    value = await input({ message })
    if (!value.trim()) {
      logger.warn('  This field is required. Please enter a value.')
    }
  }
  return value.trim()
}

async function optionalInput(message: string): Promise<string> {
  const value = await input({ message })
  return value.trim()
}

export async function runPrompts(project: ProjectInfo, options: { backendOnly?: boolean } = {}): Promise<UserAnswers> {
  const { backendOnly = false } = options

  let apiKey = ''
  let authDomain = ''
  let projectId = ''
  let storageBucket = ''
  let messagingSenderId = ''
  let appId = ''
  let vapidKey = ''
  let registerUrl = ''
  let unregisterUrl = ''
  let credentialsPath: string | null = null

  if (backendOnly) {
    // ── Mode: Backend Only ──────────────────────────────────────────────
    logger.info('ℹ  Backend-only setup detected.')
    logger.blank()

    // 1. Credentials first (Service Account)
    logger.info('Firebase Admin SDK requires a Service Account (credentials.json).')
    logger.info('Generate it here:')
    logger.info(`  1. Go to ${FIREBASE_CONSOLE_URL}`)
    logger.info(`  2. Project Settings → Service Accounts → Generate new private key`)
    logger.info(`  3. Download the JSON file and provide its path below.`)
    logger.info(`  Direct link: ${FIREBASE_SERVICE_ACCOUNT_URL}`)
    logger.blank()

    const credInput = await input({
      message: 'Path to your Firebase credentials.json (service account file):',
      default: './credentials.json',
    })
    credentialsPath = credInput.trim() || null

    // 2. URLs
    logger.blank()
    logger.info('Backend endpoints for token management:')
    registerUrl = await optionalInput('Token registration URL (e.g. http://localhost:3000/push/register):')
    unregisterUrl = await optionalInput('Token unregister URL (optional — press Enter to skip):')

  } else {
    // ── Mode: Standard (Frontend + Optional Backend) ─────────────────────
    logger.blank()
    logger.info('Get your config from:')
    logger.info(`  Firebase Console → Project Settings → Your apps → SDK setup and configuration`)
    logger.info(`  Link: ${FIREBASE_CONSOLE_URL}`)
    logger.blank()

    apiKey = await requiredInput('API Key:')
    authDomain = await requiredInput('Auth Domain:')
    projectId = await requiredInput('Project ID:')
    storageBucket = await requiredInput('Storage Bucket:')
    messagingSenderId = await requiredInput('Messaging Sender ID:')
    appId = await requiredInput('App ID:')

    logger.blank()
    logger.info('VAPID Key (Web Push certificate):')
    logger.info(`  Get it from: Firebase Console → Cloud Messaging → Web Push certificates`)
    logger.info(`  Link: ${FIREBASE_MESSAGING_URL}`)
    logger.info(`  Or generate outside Firebase: ${VAPID_GENERATOR_URL}`)
    logger.blank()
    vapidKey = await requiredInput('Enter your VAPID key:')

    if (project.scope === 'both') {
      logger.blank()
      logger.info('Backend configuration for token management:')
      registerUrl = await requiredInput('Token registration URL (e.g. http://localhost:3000/push/register):')
      unregisterUrl = await optionalInput('Token unregister URL (optional — press Enter to skip):')

      logger.blank()
      logger.info('Service Account (for Firebase Admin SDK):')
      logger.info(`  Don't have one? Generate it here:`)
      logger.info(`  1. Go to ${FIREBASE_CONSOLE_URL}`)
      logger.info(`  2. Project Settings → Service Accounts → Generate new private key`)
      logger.info(`  3. Download the JSON file and paste its path below.`)
      logger.info(`  Direct link: ${FIREBASE_SERVICE_ACCOUNT_URL}`)
      logger.blank()
      logger.info('  Press Enter to skip and add it manually to our_pkg.json later.')
      const credInput = await input({
        message: 'Path to your Firebase credentials.json:',
        default: './credentials.json',
      })
      credentialsPath = credInput.trim() || null
    }
  }

  const firebase: FirebaseWebConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    vapidKey,
  }

  const backendUrls: BackendConfig = {
    registerUrl,
    unregisterUrl,
    credentialsPath: null,
  }

  // ── Determine env prefix based on detected framework ────────────────
  // Next.js → NEXT_PUBLIC_, React (including Vite) → no prefix
  const envPrefix = project.isNextJs ? 'NEXT_PUBLIC_' : ''
  const prefixLabel = envPrefix || 'none'

  // ── FCM key definitions (bare names — prefix applied at write time) ───
  const fcmKeys: Array<{ bare: string; value: string }> = [
    { bare: 'FCM_API_KEY',            value: firebase.apiKey },
    { bare: 'FCM_AUTH_DOMAIN',        value: firebase.authDomain },
    { bare: 'FCM_PROJECT_ID',         value: firebase.projectId },
    { bare: 'FCM_STORAGE_BUCKET',     value: firebase.storageBucket },
    { bare: 'FCM_MESSAGING_SENDER_ID',value: firebase.messagingSenderId },
    { bare: 'FCM_APP_ID',             value: firebase.appId },
    { bare: 'FCM_VAPID_KEY',          value: firebase.vapidKey },
  ]

  // ── Environment Variables — Only for frontend-enabled setups ─────────
  if (apiKey && !backendOnly) {

    logger.blank()
    logger.raw('──────────────────────────────────────────────')
    logger.raw('  Add these to your .env file')
    logger.raw('──────────────────────────────────────────────')
    logger.blank()
    for (const { bare, value } of fcmKeys) {
      logger.raw(`  ${envPrefix}${bare}=${value}`)
    }
    logger.blank()
    logger.warn('  ⚠  Never commit .env to git. Add it to .gitignore now.')
    logger.raw('──────────────────────────────────────────────')

    await input({ message: 'Press Enter once you\'ve added these values...' })
    logger.blank()

    const saveEnv = await confirm({
      message: 'Save environment variables to .env file automatically?',
      default: true,
    })

    if (saveEnv) {
      try {
        const envPath = path.join(project.rootDir, '.env')
        const envExists = await fileExists(envPath)

        let existingLines: string[] = []
        if (envExists) {
          const raw = await readFile(envPath)
          // Preserve trailing newline behaviour by splitting carefully
          existingLines = raw.split('\n')
          // Drop a single trailing empty string that split() produces for files ending with \n
          if (existingLines.length > 0 && existingLines[existingLines.length - 1] === '') {
            existingLines.pop()
          }
        }

        // Build a map of prefixed-key → line-index for existing keys
        const lineIndexByKey: Record<string, number> = {}
        for (let i = 0; i < existingLines.length; i++) {
          const line = existingLines[i]
          const eqIdx = line.indexOf('=')
          if (eqIdx > 0 && !line.trimStart().startsWith('#')) {
            const key = line.substring(0, eqIdx).trim()
            lineIndexByKey[key] = i
          }
        }

        // Merge: update in-place or collect keys to append
        const toAppend: string[] = []
        for (const { bare, value } of fcmKeys) {
          const prefixedKey = `${envPrefix}${bare}`
          if (prefixedKey in lineIndexByKey) {
            // Update value in place on the same line — preserves surrounding lines exactly
            existingLines[lineIndexByKey[prefixedKey]] = `${prefixedKey}=${value}`
          } else {
            toAppend.push(`${prefixedKey}=${value}`)
          }
        }

        // Reassemble: existing (possibly updated) lines + new keys
        const finalLines = [
          ...existingLines,
          ...toAppend,
        ]
        const finalContent = finalLines.join('\n') + '\n'

        await writeFile(envPath, finalContent)
        logger.success(`✓  .env updated (${fcmKeys.length} keys) — prefix: ${prefixLabel}`)

        // Ensure .env is in .gitignore
        const gitignorePath = path.join(project.rootDir, GITIGNORE_FILENAME)
        let gitignoreContent = ''
        try {
          gitignoreContent = await readFile(gitignorePath)
        } catch {
          // .gitignore doesn't exist yet — will be created by appendToFile
        }
        const gitignoreLines = gitignoreContent.split('\n').map(l => l.trim())
        if (!gitignoreLines.includes('.env')) {
          await appendToFile(gitignorePath, '.env')
          logger.success('✓  .env added to .gitignore')
        }
      } catch (envErr: any) {
        logger.warn(`⚠  Could not save .env file: ${envErr.message}`)
        logger.info('   Add the environment variables manually.')
      }
    }
  }

  // ── Usage guide ───────────────────────────────────────────────────────
  if (!backendOnly) {
    logger.blank()
    logger.raw('──────────────────────────────────────────────')
    logger.raw('  How to use QuickFCM in your app')
    logger.raw('──────────────────────────────────────────────')
    logger.blank()
    logger.raw('  // 1. In src/NotificationHandler/config.ts (already generated):')
    logger.raw('  export const pushConfig = {')
    logger.raw(`    apiKey: process.env.${envPrefix}FCM_API_KEY!,`)
    logger.raw(`    authDomain: process.env.${envPrefix}FCM_AUTH_DOMAIN!,`)
    logger.raw(`    projectId: process.env.${envPrefix}FCM_PROJECT_ID!,`)
    logger.raw(`    storageBucket: process.env.${envPrefix}FCM_STORAGE_BUCKET!,`)
    logger.raw(`    messagingSenderId: process.env.${envPrefix}FCM_MESSAGING_SENDER_ID!,`)
    logger.raw(`    appId: process.env.${envPrefix}FCM_APP_ID!,`)
    logger.raw(`    vapidKey: process.env.${envPrefix}FCM_VAPID_KEY!,`)
    logger.raw("    registerUrl: '/api/push/register',")
    logger.raw('  }')
    logger.blank()
    logger.raw('  // 2. Wrap your app root (src/App.tsx or src/main.tsx):')
    logger.raw("  import { CustomPushProvider } from 'quick-fcm'")
    logger.raw("  import { pushConfig } from './NotificationHandler/config'")
    logger.blank()
    logger.raw('  function App() {')
    logger.raw('    return (')
    logger.raw('      <CustomPushProvider config={pushConfig}>')
    logger.raw('        <YourApp />')
    logger.raw('      </CustomPushProvider>')
    logger.raw('    )')
    logger.raw('  }')
    logger.blank()
    logger.raw('  // 3. Use in any component:')
    logger.raw("  import { usePushMessage } from 'quick-fcm'")
    logger.blank()
    logger.raw('  function NotificationButton() {')
    logger.raw('    const { messages, sendMessage, requestPermission } = usePushMessage()')
    logger.raw('    return (')
    logger.raw('      <div>')
    logger.raw("        <button onClick={requestPermission}>Enable Notifications</button>")
    logger.raw("        <button onClick={() => sendMessage('Hello', 'World')}>Send Test</button>")
    logger.raw('        {messages.map(m => <div key={m.id}>{m.title}: {m.body}</div>)}')
    logger.raw('      </div>')
    logger.raw('    )')
    logger.raw('  }')
    logger.blank()
    logger.raw('  // 4. Get the raw token anywhere:')
    logger.raw("  import { getPushToken } from 'quick-fcm'")
    logger.raw('  const token = await getPushToken(pushConfig)')
    logger.raw("  console.log('FCM Token:', token)")
    logger.raw('──────────────────────────────────────────────')
    logger.blank()
  }

  return {
    firebase,
    backendUrls,
    credentialsPath,
  }
}
