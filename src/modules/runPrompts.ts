import { input, confirm } from '@inquirer/prompts'
import * as fs from 'fs'
import * as path from 'path'
import { ProjectInfo, UserAnswers, FirebaseWebConfig, BackendConfig } from '../types'
import { logger } from '../utils/logger'
import { FIREBASE_CONSOLE_URL, FIREBASE_MESSAGING_URL } from '../constants'

async function requiredInput(message: string): Promise<string> {
  let value = ''
  while (!value.trim()) {
    value = await input({ message })
    if (!value.trim()) {
      logger.warn('This field is required. Please enter a value.')
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
    logger.info('Backend-only setup detected.')
    
    // 1. Credentials first (Service Account)
    logger.blank()
    logger.info("Firebase Admin SDK requires a Service Account (credentials.json).")
    logger.info(`Generate it here: ${FIREBASE_CONSOLE_URL} → Project Settings → Service Accounts`)
    logger.blank()

    const credInput = await input({
      message: 'Path to your Firebase credentials.json (service account file):',
    })
    credentialsPath = credInput.trim() || null

    // 2. Optional Web Config (for service config if needed)
    logger.blank()
    const wantWebConfig = await confirm({
      message: 'Do you also want to provide Firebase Web Config? (Usually not needed for backend-only)',
      default: false
    })

    if (wantWebConfig) {
      apiKey = await requiredInput('API Key:')
      authDomain = await requiredInput('Auth Domain:')
      projectId = await requiredInput('Project ID:')
      storageBucket = await requiredInput('Storage Bucket:')
      messagingSenderId = await requiredInput('Messaging Sender ID:')
      appId = await requiredInput('App ID:')
      vapidKey = await requiredInput('VAPID Key:')
    }

    // 3. URLs
    logger.blank()
    logger.info('Backend configuration for token management:')
    registerUrl = await optionalInput('Default token registration URL (e.g. http://localhost:3000/push/register):')
    unregisterUrl = await optionalInput('Default token unregister URL (optional):')

  } else {
    // ── Mode: Standard (Frontend + Optional Backend) ─────────────────────
    logger.blank()
    logger.info('Get your config from:')
    logger.info('Firebase Console → Project Settings → Your apps → SDK setup and configuration')
    logger.blank()

    apiKey = await requiredInput('API Key:')
    authDomain = await requiredInput('Auth Domain:')
    projectId = await requiredInput('Project ID:')
    storageBucket = await requiredInput('Storage Bucket:')
    messagingSenderId = await requiredInput('Messaging Sender ID:')
    appId = await requiredInput('App ID:')

    logger.blank()
    logger.info('Get VAPID key: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates')
    logger.info(`Link: ${FIREBASE_MESSAGING_URL}`)
    logger.blank()
    vapidKey = await requiredInput('Enter your VAPID key:')

    if (project.scope === 'both') {
      logger.blank()
      logger.info('Backend configuration for token management:')
      registerUrl = await requiredInput('Token registration URL:')
      unregisterUrl = await optionalInput('Token unregister URL (optional):')

      logger.blank()
      logger.info("Service Account (for Admin SDK):")
      const credInput = await input({
        message: 'Path to your Firebase credentials.json:',
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

  // ── Environment Variables ───────────────────────────────────────────
  if (apiKey) {
    const separator = '─'.repeat(46)
    const envBlock = buildEnvBlock(firebase, separator)
    console.log(envBlock)

    await input({ message: "Press Enter once you've added these values to your .env file..." })

    if (await confirm({ message: 'Save environment variables to .env file automatically?', default: true })) {
      try {
        const envContent = buildEnvFileContent(firebase)
        fs.writeFileSync(path.join(project.rootDir, '.env'), envContent + '\n', { flag: 'a' })
        logger.success('Environment variables appended to .env file')
      } catch {
        logger.warn('Could not save .env file.')
      }
    }
  }

  // ── Usage & Guide ───────────────────────────────────────────────────
  const separator = '─'.repeat(46)
  if (!backendOnly) {
     const usageBlock = buildUsageBlock(separator, registerUrl || '/api/push/register')
     console.log(usageBlock)
  }
  
  await saveUsageMd(project.srcDir, firebase, registerUrl || '/api/push/register', backendOnly)

  return {
    firebase,
    backendUrls,
    credentialsPath,
  }
}

function buildEnvBlock(firebase: FirebaseWebConfig, separator: string): string {
  return `
${separator}
  Add these to your .env file
${separator}

  REACT_APP_FIREBASE_API_KEY=${firebase.apiKey}
  REACT_APP_FIREBASE_AUTH_DOMAIN=${firebase.authDomain}
  REACT_APP_FIREBASE_PROJECT_ID=${firebase.projectId}
  REACT_APP_FIREBASE_STORAGE_BUCKET=${firebase.storageBucket}
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${firebase.messagingSenderId}
  REACT_APP_FIREBASE_APP_ID=${firebase.appId}
  REACT_APP_FIREBASE_VAPID_KEY=${firebase.vapidKey}

  ⚠  Never commit .env to git. Add it to .gitignore now.
${separator}`
}

function buildEnvFileContent(firebase: FirebaseWebConfig): string {
  return `# Firebase Configuration - Generated by CustomPush
REACT_APP_FIREBASE_API_KEY=${firebase.apiKey}
REACT_APP_FIREBASE_AUTH_DOMAIN=${firebase.authDomain}
REACT_APP_FIREBASE_PROJECT_ID=${firebase.projectId}
REACT_APP_FIREBASE_STORAGE_BUCKET=${firebase.storageBucket}
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${firebase.messagingSenderId}
REACT_APP_FIREBASE_APP_ID=${firebase.appId}
REACT_APP_FIREBASE_VAPID_KEY=${firebase.vapidKey}
`
}

function buildUsageBlock(separator: string, registerUrl: string): string {
  return `
${separator}
  How to use custom-push in your app
${separator}

  // 1. Wrap your app root:
  import { CustomPushProvider } from 'custom-push'
  import { pushConfig } from './pushConfig'

  function App() {
    return (
      <CustomPushProvider config={pushConfig}>
        <YourApp />
      </CustomPushProvider>
    )
  }

  // 2. Use in any component:
  import { usePushMessage } from 'custom-push'
  const { sendMessage } = usePushMessage()
${separator}`
}

async function saveUsageMd(srcDir: string, firebase: FirebaseWebConfig, registerUrl: string, backendOnly: boolean): Promise<void> {
  const pushDir = path.join(srcDir, 'push')
  const usagePath = path.join(pushDir, 'USAGE.md')

  try {
    if (!fs.existsSync(pushDir)) fs.mkdirSync(pushDir, { recursive: true })

    let content = `# custom-push Usage Guide\n\n`
    
    if (!backendOnly && firebase.apiKey) {
      content += `## Frontend Setup\nAdd environment variables to your .env file and wrap your app in \`<CustomPushProvider />\`.\n\n`
    }
    
    content += `## Backend Usage\nUse the generated \`sendPushNotification\` helper to push messages from your server.\n`

    fs.writeFileSync(usagePath, content, 'utf8')
    logger.success(`Usage guide saved to src/push/USAGE.md`)
  } catch {
    logger.warn('Could not write USAGE.md')
  }
}
