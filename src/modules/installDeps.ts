import { spawn } from 'child_process'
import * as path from 'path'
import { ProjectInfo } from '../types'
import { fileExists, readJson } from '../utils/fileUtils'
import { logger } from '../utils/logger'
import { PACKAGE_ROOT } from '../constants'

/**
 * Packages the CLI needs to be present in the target project before scaffolding.
 * The install order follows the spec: quick-fcm first, firebase second.
 */
const REQUIRED_PACKAGES: Array<'quick-fcm' | 'firebase'> = ['quick-fcm', 'firebase']

/**
 * Detect which package manager the target project uses by checking its lockfiles.
 */
async function detectPackageManager(rootDir: string): Promise<'pnpm' | 'yarn' | 'npm'> {
  if (await fileExists(path.join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (await fileExists(path.join(rootDir, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

/**
 * Run a shell command, streaming output live to the terminal.
 * Resolves with the exit code.
 */
function runInstall(pm: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(pm, args, {
      stdio: 'inherit',
      cwd,
      shell: process.platform === 'win32',
    })
    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

/**
 * Check if a package is already installed (in deps or devDeps).
 */
function isInstalled(pkg: string, packageJson: Record<string, any>): boolean {
  const deps = packageJson.dependencies ?? {}
  const devDeps = packageJson.devDependencies ?? {}
  return pkg in deps || pkg in devDeps
}

/**
 * Before scaffolding, ensure `firebase` and `quick-fcm` are present in the
 * target project. Versions come from the CLI's own `pinnedDeps` field so they
 * are always what the CLI was tested against.
 *
 * Skipped entirely in backendOnly mode.
 */
export async function installDeps(project: ProjectInfo, options: { backendOnly?: boolean } = {}): Promise<void> {
  const { backendOnly = false } = options
  if (backendOnly) return

  // ── Read CLI package.json for versions ────────────────────────────────
  let pinnedDeps: Record<string, string> = {}
  let cliVersion = 'latest'
  try {
    const cliPkg = await readJson<Record<string, any>>(path.join(PACKAGE_ROOT, 'package.json'))
    pinnedDeps = cliPkg.pinnedDeps ?? {}
    // quick-fcm always uses the CLI's own published version — never a hardcode
    cliVersion = cliPkg.version ?? 'latest'
  } catch {
    logger.warn('⚠  Could not read CLI package.json — skipping dependency auto-install.')
    return
  }

  const pm = await detectPackageManager(project.rootDir)
  const installFlag = pm === 'yarn' ? 'add' : 'install'

  for (const pkg of REQUIRED_PACKAGES) {
    if (isInstalled(pkg, project.packageJson)) {
      // Already present — skip silently
      continue
    }

    // quick-fcm: always install the same version as the running CLI
    const version = pkg === 'quick-fcm' ? cliVersion : pinnedDeps[pkg]
    if (!version) {
      logger.warn(`⚠  No pinned version found for ${pkg} — skipping auto-install.`)
      continue
    }

    const versionedPkg = `${pkg}@${version}`
    logger.info(`ℹ  Installing ${versionedPkg}...`)

    const exitCode = await runInstall(pm, [installFlag, versionedPkg], project.rootDir)

    if (exitCode === 0) {
      logger.success(`✓  ${versionedPkg} installed`)
    } else {
      logger.warn(`⚠  Could not install ${versionedPkg}. Run manually: ${pm} ${installFlag} ${versionedPkg}`)
      // Continue — do not exit; user can fix manually
    }
  }
}
