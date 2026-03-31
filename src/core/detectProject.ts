import * as path from 'path'
import * as fs from 'fs/promises'
import { ProjectInfo, Language, BackendFramework, Scope } from '../types'
import { logger } from '../utils/logger'
import { fileExists, readJson, ensureDir } from '../utils/fileUtils'

export async function detectProject(cwd: string, options: { backendOnly?: boolean } = {}): Promise<ProjectInfo> {
  const { backendOnly = false } = options
  const rootDir = cwd

  // ── package.json ──────────────────────────────────────────────────────
  const pkgPath = path.join(rootDir, 'package.json')
  if (!(await fileExists(pkgPath))) {
    logger.error('✖  No package.json found. Run quick-fcm init from your project root.')
    process.exit(1)
  }
  const packageJson = await readJson<Record<string, any>>(pkgPath)
  const deps = packageJson.dependencies || {}
  const devDeps = packageJson.devDependencies || {}

  // ── language ──────────────────────────────────────────────────────────
  const hasTsConfig = await fileExists(path.join(rootDir, 'tsconfig.json'))
  const language: Language = hasTsConfig ? 'typescript' : 'javascript'

  // ── react version ─────────────────────────────────────────────────────
  const rawReact: string | undefined = deps['react'] || devDeps['react']
  const reactVersion = rawReact ? rawReact.replace(/[\^~]/g, '') : null

  // ── firebase version ──────────────────────────────────────────────────
  const rawFirebase: string | undefined = deps['firebase']
  const firebaseVersion = rawFirebase ? rawFirebase.replace(/[\^~]/g, '') : null
  const hasFirebase = firebaseVersion !== null

  // ── framework detection ───────────────────────────────────────────────
  const isNextJs = !!(deps['next'] || devDeps['next'])
  const isVite = !!(
    devDeps['vite'] ||
    deps['vite'] ||
    await fileExists(path.join(rootDir, 'vite.config.ts')) ||
    await fileExists(path.join(rootDir, 'vite.config.js'))
  )

  // ── unsupported project guard (frontend mode only) ────────────────────
  if (!backendOnly && !isNextJs && !rawReact) {
    console.error('✖  This project does not use React or Next.js.')
    console.error('   custom-push only supports React and Next.js frontend projects.')
    process.exit(1)
  }

  // ── Next.js router type detection ────────────────────────────────────
  // Check both root-level (no src/) and src/-level (with src/) directories
  let nextRouterType: 'app' | 'pages' | null = null
  if (isNextJs) {
    const hasSrcDir = await fileExists(path.join(rootDir, 'src'))
    const hasAppDir =
      (await fileExists(path.join(rootDir, 'app'))) ||
      (hasSrcDir && (await fileExists(path.join(rootDir, 'src', 'app'))))
    const hasPagesDir =
      (await fileExists(path.join(rootDir, 'pages'))) ||
      (hasSrcDir && (await fileExists(path.join(rootDir, 'src', 'pages'))))

    if (hasAppDir) {
      nextRouterType = 'app'
    } else if (hasPagesDir) {
      nextRouterType = 'pages'
    } else {
      nextRouterType = 'app'
      logger.info('ℹ  Could not detect router type. Assuming App Router.')
    }
  }

  // ── backend framework ─────────────────────────────────────────────────
  let backendFramework: BackendFramework = null
  const hasFirebaseAdmin = !!(deps['firebase-admin'] || devDeps['firebase-admin'])

  if (deps['@nestjs/core'] || devDeps['@nestjs/core']) {
    backendFramework = 'nestjs'
  } else if (deps['express']) {
    backendFramework = 'express'
  }

  // ── scope ─────────────────────────────────────────────────────────────
  const scope: Scope = backendFramework !== null ? 'both' : 'frontend'

  // ── srcDir ────────────────────────────────────────────────────────────
  const srcCandidate = path.join(rootDir, 'src')
  const srcDir = (await fileExists(srcCandidate)) ? srcCandidate : rootDir

  // ── publicDir ─────────────────────────────────────────────────────────
  const publicDir = path.join(rootDir, 'public')

  // Only create public directory and warn if not in backend-only mode
  if (!backendOnly) {
    if (!(await fileExists(publicDir))) {
      await ensureDir(publicDir)
      logger.info('ℹ  No /public directory found. Created it.')
    }
  }

  // ── JSX extension detection ───────────────────────────────────────────
  // Scan srcDir (1 level deep) for user's component file extension convention.
  // We check BOTH TypeScript and JavaScript projects.
  //
  // TypeScript:
  //   - Has .tsx files → user uses .tsx for JSX components (standard convention)
  //   - No .tsx files  → user uses .ts only (e.g. fresh project, or backend-only TS)
  //                     We still generate .tsx for JSX components — TypeScript
  //                     REQUIRES .tsx for any file containing JSX syntax.
  //
  // JavaScript:
  //   - Has .jsx files → user uses .jsx (Vite / CRA style)
  //   - No .jsx files  → user uses .js  (Next.js JS default, zero .jsx files)

  // Shared shallow scanner
  const scanForExt = async (dir: string, ext: string): Promise<boolean> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(ext)) return true
        if (entry.isDirectory()) {
          try {
            const sub = await fs.readdir(path.join(dir, entry.name), { withFileTypes: true })
            if (sub.some(e => e.isFile() && e.name.endsWith(ext))) return true
          } catch { /* skip unreadable */ }
        }
      }
    } catch { /* dir unreadable — fallback */ }
    return false
  }

  let jsxExtension: 'tsx' | 'jsx' | 'js'

  if (language === 'typescript') {
    // TypeScript REQUIRES .tsx for JSX. Even if user has no .tsx yet (brand-new project),
    // we must generate .tsx for JSX component files or TypeScript will error.
    // Scan is still done so we can log an accurate message to the user.
    const hasTsx = await scanForExt(srcDir, '.tsx')
    jsxExtension = 'tsx'  // always tsx for TS
    if (!hasTsx) {
      logger.info('ℹ  No .tsx files detected. Generating .tsx for JSX components (TypeScript requires this).')
    }
  } else {
    // JavaScript: mirror the user's existing convention
    const hasJsx = await scanForExt(srcDir, '.jsx')
    jsxExtension = hasJsx ? 'jsx' : 'js'
  }

  return {
    rootDir,
    srcDir,
    publicDir,
    language,
    reactVersion,
    firebaseVersion,
    hasFirebase,
    backendFramework,
    scope,
    hasTsConfig,
    isNextJs,
    nextRouterType,
    isVite,
    hasFirebaseAdmin,
    packageJson,
    jsxExtension,
  }
}
