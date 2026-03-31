import * as path from 'path'
import { CLIContext } from '../types'
import { logger } from '../utils/logger'
import { readJson, writeJson, readFile, appendToFile } from '../utils/fileUtils'
import { checkConflicts } from '../core/checkConflicts'
import { CONFIG_FILENAME, FIREBASE_VERSION_RANGE, REACT_VERSION_RANGE, PACKAGE_ROOT, GITIGNORE_FILENAME } from '../constants'

export async function generateConfig(context: CLIContext): Promise<void> {
  const { project, answers } = context

  // Read CLI package.json for QuickFCMVersion
  let QuickFCMVersion = '1.1.0'
  try {
    const cliPkg = await readJson<Record<string, any>>(path.join(PACKAGE_ROOT, 'package.json'))
    QuickFCMVersion = cliPkg.version || '1.1.0'
  } catch {
    // fallback
  }

  const now = new Date().toISOString()

  // Build relative credentials path
  let relativeCredentialsPath: string | null = null
  if (answers.backendUrls.credentialsPath) {
    relativeCredentialsPath = './' + path.relative(project.rootDir, answers.backendUrls.credentialsPath)
  }

  const config = {
    version: '1.0.0',
    generatedAt: now,
    QuickFCMVersion,
    stack: {
      language: project.language,
      scope: project.scope,
      backendFramework: project.backendFramework,
      isNextJs: project.isNextJs,
      isVite: project.isVite,
    },
    firebase: {
      apiKey: answers.firebase.apiKey,
      authDomain: answers.firebase.authDomain,
      projectId: answers.firebase.projectId,
      storageBucket: answers.firebase.storageBucket,
      messagingSenderId: answers.firebase.messagingSenderId,
      appId: answers.firebase.appId,
      vapidKey: answers.firebase.vapidKey,
    },
    backend: {
      registerUrl: answers.backendUrls.registerUrl,
      unregisterUrl: answers.backendUrls.unregisterUrl,
      credentialsPath: relativeCredentialsPath,
    },
    notification: {
      defaultIcon: '/icon.png',
      defaultBadge: '/badge.png',
      defaultTitle: answers.firebase.projectId || 'Notification',
      clickAction: '/',
    },
    serviceWorker: {
      path: `/${context.serviceWorkerFilename}`,
      generatedAt: now,
    },
    compatibility: {
      firebaseRequired: FIREBASE_VERSION_RANGE,
      reactRequired: REACT_VERSION_RANGE,
      firebaseInstalled: project.firebaseVersion,
      reactInstalled: project.reactVersion,
    },
  }

  const filePath = path.join(project.rootDir, CONFIG_FILENAME)
  const content = JSON.stringify(config, null, 2) + '\n'

  // Run conflict check
  const resolved = await checkConflicts(
    [{ path: filePath, content, description: 'QuickFCM configuration' }],
    project
  )

  for (const file of resolved) {
    if (file.action === 'skip') {
      logger.info(`ℹ  Kept existing ${CONFIG_FILENAME}`)
      context.scaffolded.push({
        absolutePath: filePath,
        relativePath: CONFIG_FILENAME,
        status: 'skipped',
        description: 'Kept existing file',
      })
    } else {
      try {
        await writeJson(filePath, config)
        context.scaffolded.push({
          absolutePath: filePath,
          relativePath: CONFIG_FILENAME,
          status: 'created',
          description: 'QuickFCM configuration',
        })

        // Add quickfcm.config.json to .gitignore
        const gitignorePath = path.join(project.rootDir, GITIGNORE_FILENAME)
        let gitignoreContent = ''
        try { gitignoreContent = await readFile(gitignorePath) } catch { /* will be created */ }
        const gitignoreLines = gitignoreContent.split('\n').map(l => l.trim())
        if (!gitignoreLines.includes(CONFIG_FILENAME)) {
          await appendToFile(gitignorePath, CONFIG_FILENAME)
          logger.success(`✓  ${CONFIG_FILENAME} added to .gitignore`)
        }
      } catch (writeErr: any) {
        logger.error(`✖  Failed to write ${CONFIG_FILENAME}: ${writeErr.message}`)
      }
    }
  }
}
