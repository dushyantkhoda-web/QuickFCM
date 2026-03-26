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

export async function runPrompts(project: ProjectInfo, options: { backendOnly?: boolean } = {}): Promise<UserAnswers> {
  const { backendOnly = false } = options
  // ── Question 1 — Firebase web config ──────────────────────────────────
  logger.blank()
  if (!backendOnly) {
    logger.info('Get your config from:')
    logger.info('Firebase Console → Project Settings → Your apps → SDK setup and configuration')
  } else {
    logger.info('Backend setup - Firebase config for service configuration')
  }
  logger.blank()

  const apiKey = await requiredInput('API Key:')
  const authDomain = await requiredInput('Auth Domain:')
  const projectId = await requiredInput('Project ID:')
  const storageBucket = await requiredInput('Storage Bucket:')
  const messagingSenderId = await requiredInput('Messaging Sender ID:')
  const appId = await requiredInput('App ID:')

  // ── Question 2 — VAPID key ───────────────────────────────────────────
  logger.blank()
  logger.info('Get it from: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates')
  logger.info(`Link: ${FIREBASE_MESSAGING_URL}`)
  logger.blank()

  const vapidKey = await requiredInput('Enter your VAPID key (Web Push certificate):')

  const firebase: FirebaseWebConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    vapidKey,
  }

  // ── Question 3 — Backend URLs ─────────────────────────────────────────
  let registerUrl = ''
  let unregisterUrl = ''
  let credentialsPath: string | null = null

  if (project.scope === 'both') {
    logger.blank()
    logger.info('Backend configuration for token management:')
    registerUrl = await requiredInput('Token registration URL (e.g. http://localhost:3000/push/register):')

    unregisterUrl = await input({
      message: 'Token unregister URL (optional — press Enter to skip):',
    })
    unregisterUrl = unregisterUrl.trim()

    // ── Question 4 — credentials.json path ──────────────────────────────
    logger.blank()
    logger.info("Don't have one? Generate it here:")
    logger.info(`1. Go to ${FIREBASE_CONSOLE_URL}`)
    logger.info('2. Project Settings → Service Accounts → Generate new private key')
    logger.info('3. Download the JSON file and paste its path below.')
    logger.blank()

    const credInput = await input({
      message: 'Path to your Firebase credentials.json (service account file):',
    })
    credentialsPath = credInput.trim() || null
  }

  const backendUrls: BackendConfig = {
    registerUrl,
    unregisterUrl,
    credentialsPath: null,  // will be set by readCredentials step
  }

  // ── ENV Variable prompt box ───────────────────────────────────────────
  const separator = '─'.repeat(46)
  const envBlock = buildEnvBlock(firebase, separator)
  console.log(envBlock)

  // Wait for user to acknowledge before proceeding
  await input({
    message: "Press Enter once you've added these values to your .env file...",
  })

  // Ask if we should also save env to disk
  const shouldSaveEnv = await confirm({
    message: 'Save environment variables to .env file automatically?',
    default: true,
  })

  if (shouldSaveEnv) {
    try {
      const envContent = buildEnvFileContent(firebase)
      fs.writeFileSync(path.join(project.rootDir, '.env'), envContent + '\n', { flag: 'a' })
      logger.success('Environment variables appended to .env file')
    } catch {
      logger.warn('Could not save .env file. Please add it manually.')
    }
  }

  // ── USAGE snippet ─────────────────────────────────────────────────────
  const usageBlock = buildUsageBlock(separator, registerUrl || '/api/push/register')
  console.log(usageBlock)

  // Save USAGE.md to src/push/
  await saveUsageMd(project.srcDir, firebase, registerUrl || '/api/push/register')

  return {
    firebase,
    backendUrls,
    credentialsPath,
  }
}

// ── Helper: ENV block ─────────────────────────────────────────────────────────

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
# Add this to your .env file

REACT_APP_FIREBASE_API_KEY=${firebase.apiKey}
REACT_APP_FIREBASE_AUTH_DOMAIN=${firebase.authDomain}
REACT_APP_FIREBASE_PROJECT_ID=${firebase.projectId}
REACT_APP_FIREBASE_STORAGE_BUCKET=${firebase.storageBucket}
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${firebase.messagingSenderId}
REACT_APP_FIREBASE_APP_ID=${firebase.appId}
REACT_APP_FIREBASE_VAPID_KEY=${firebase.vapidKey}

# For Next.js, use NEXT_PUBLIC_ prefix instead of REACT_APP_`
}

// ── Helper: USAGE block ───────────────────────────────────────────────────────

function buildUsageBlock(separator: string, registerUrl: string): string {
  return `
${separator}
  How to use custom-push in your app
${separator}

  // 1. In src/pushConfig.ts (already generated):
  export const pushConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY!,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.REACT_APP_FIREBASE_APP_ID!,
    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY!,
    registerUrl: '${registerUrl}',
  }

  // 2. Wrap your app root (src/App.tsx or src/main.tsx):
  import { CustomPushProvider } from 'custom-push'
  import { pushConfig } from './pushConfig'

  function App() {
    return (
      <CustomPushProvider config={pushConfig}>
        <YourApp />
      </CustomPushProvider>
    )
  }

  // 3. Use in any component:
  import { usePushMessage } from 'custom-push'

  function NotificationButton() {
    const { messages, sendMessage, requestPermission } = usePushMessage()

    return (
      <div>
        <button onClick={requestPermission}>Enable Notifications</button>
        <button onClick={() => sendMessage('Hello', 'World')}>Send Test</button>
        {messages.map(m => <div key={m.id}>{m.title}: {m.body}</div>)}
      </div>
    )
  }

  // 4. Get the raw token anywhere:
  import { getPushToken } from 'custom-push'
  const token = await getPushToken(pushConfig)
  console.log('FCM Token:', token)
${separator}`
}

// ── Helper: Save USAGE.md ─────────────────────────────────────────────────────

async function saveUsageMd(srcDir: string, firebase: FirebaseWebConfig, registerUrl: string): Promise<void> {
  const pushDir = path.join(srcDir, 'push')
  const usagePath = path.join(pushDir, 'USAGE.md')

  try {
    if (!fs.existsSync(pushDir)) {
      fs.mkdirSync(pushDir, { recursive: true })
    }

    const content = `# custom-push Usage Guide

Generated by \`npx custom-push init\`

## 1. Environment Variables

Add these to your \`.env\` file:

\`\`\`env
REACT_APP_FIREBASE_API_KEY=${firebase.apiKey}
REACT_APP_FIREBASE_AUTH_DOMAIN=${firebase.authDomain}
REACT_APP_FIREBASE_PROJECT_ID=${firebase.projectId}
REACT_APP_FIREBASE_STORAGE_BUCKET=${firebase.storageBucket}
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=${firebase.messagingSenderId}
REACT_APP_FIREBASE_APP_ID=${firebase.appId}
REACT_APP_FIREBASE_VAPID_KEY=<your-vapid-key>
\`\`\`

> ⚠️ Never commit \`.env\` to git. Add it to \`.gitignore\` now.

## 2. Push Config (src/pushConfig.ts)

\`\`\`ts
export const pushConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY!,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.REACT_APP_FIREBASE_APP_ID!,
  vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY!,
  registerUrl: '${registerUrl}',
}
\`\`\`

## 3. Wrap Your App Root

\`\`\`tsx
import { CustomPushProvider } from 'custom-push'
import { pushConfig } from './pushConfig'

function App() {
  return (
    <CustomPushProvider config={pushConfig}>
      <YourApp />
    </CustomPushProvider>
  )
}
\`\`\`

## 4. Use in Any Component

\`\`\`tsx
import { usePushMessage } from 'custom-push'

function NotificationButton() {
  const { messages, sendMessage, requestPermission } = usePushMessage()

  return (
    <div>
      <button onClick={requestPermission}>Enable Notifications</button>
      <button onClick={() => sendMessage('Hello', 'World')}>Send Test</button>
      {messages.map(m => <div key={m.id}>{m.title}: {m.body}</div>)}
    </div>
  )
}
\`\`\`

## 5. Get Raw Token

\`\`\`ts
import { getPushToken } from 'custom-push'
const token = await getPushToken(pushConfig)
console.log('FCM Token:', token)
\`\`\`
`

    fs.writeFileSync(usagePath, content, 'utf8')
    logger.success(`Usage guide saved to src/push/USAGE.md`)
  } catch {
    logger.warn('Could not write src/push/USAGE.md')
  }
}
