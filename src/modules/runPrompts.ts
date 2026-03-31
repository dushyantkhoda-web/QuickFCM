import { input } from '@inquirer/prompts'
import { ProjectInfo, UserAnswers, FirebaseWebConfig, BackendConfig } from '../types'
import { logger } from '../utils/logger'
import {
  FIREBASE_CONSOLE_URL,
  FIREBASE_MESSAGING_URL,
  FIREBASE_SERVICE_ACCOUNT_URL,
  VAPID_GENERATOR_URL,
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
      logger.info('  Press Enter to skip and add it manually to quickfcm.config.json later.')
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

  // ── Usage guide ───────────────────────────────────────────────────────
  if (!backendOnly) {
    logger.blank()
    logger.raw('──────────────────────────────────────────────')
    logger.raw('  How to use QuickFCM in your app')
    logger.raw('──────────────────────────────────────────────')
    logger.blank()
    logger.raw('  // 1. Config is already generated at:')
    logger.raw('  //    src/NotificationHandler/config.ts')
    logger.raw('  //    (reads from quickfcm.config.json — no env vars needed)')
    logger.blank()
    logger.raw('  // 2. Wrap your app root (src/App.tsx or layout.tsx):')
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
    logger.raw('    const { messages, requestPermission } = usePushMessage()')
    logger.raw('    return (')
    logger.raw('      <div>')
    logger.raw("        <button onClick={requestPermission}>Enable Notifications</button>")
    logger.raw('      </div>')
    logger.raw('    )')
    logger.raw('  }')
    logger.blank()
    logger.raw('  // 4. Get the raw token anywhere:')
    logger.raw("  import { getPushToken } from 'quick-fcm'")
    logger.raw('  const token = await getPushToken(pushConfig)')
    logger.raw("  console.log('FCM Token:', token)")
    logger.blank()
    logger.raw('  For full integration details, see:')
    logger.raw('      src/NotificationHandler/USAGE.md')
    logger.blank()
    logger.blank()
    logger.raw('──────────────────────────────────────────────')
    logger.blank()
  }

  return {
    firebase,
    backendUrls,
    credentialsPath,
  }
}
