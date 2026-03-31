# Installation Guide

## Installation Options

### Option 1: npx (Recommended)
No installation required — runs directly from npm:

```bash
npx quick-fcm init
```

### Option 2: Global Install
Install globally for use in any project:

```bash
npm install -g quick-fcm
quick-fcm init
```

### Option 3: Local Dev Install
Install as a dev dependency in your project:

```bash
npm install --save-dev quick-fcm
npx quick-fcm init
```

---

## System Requirements

### Required
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Project type**: React or Next.js frontend project

> **Note**: If the CLI detects that the project has neither `react` nor `next` in its dependencies, it exits immediately with:
> ```
> ✖  This project does not use React or Next.js.
>    custom-push only supports React and Next.js frontend projects.
> ```

### Optional (for backend features)
- **Express**: >= 4.0.0
- **NestJS**: >= 9.0.0
- **Firebase Admin SDK**: >= 12.0.0 (required for backend scaffolding)

---

## Quick Setup

### 1. Backend-Only Setup
If you only need a notification engine for your server (no frontend):

```bash
npx quick-fcm init --backend-only
```
- Skips React/Next.js detection and frontend file generation
- Generates `FCMHelper.js/ts` and routes in `src/helper/`

### 2. Standard Full Setup
For projects needing both frontend and backend:

```bash
npx quick-fcm init
```

---

## Firebase Setup Instructions

### Step 1: Create Firebase Project
1. Visit [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** and enter a project name
3. Click **Create project**

### Step 2: Add Web App
1. In your project dashboard, click **Add app** → Web icon (`</>`)
2. Enter an app nickname and click **Register app**
3. Copy the Firebase config object — the CLI will ask for these values

### Step 3: Enable Cloud Messaging
1. Go to **Project Settings → Cloud Messaging**
2. Ensure Cloud Messaging API is enabled
3. Generate a **VAPID key pair** (Web Push certificates section)
4. Copy the VAPID key — the CLI will ask for it

### Step 4: (Optional) Service Account
Required only for backend features:

1. Go to **Project Settings → Service Accounts**
2. Click **Generate new private key**
3. Download the JSON file — keep it secure, never commit it to git

---

## Project Detection

When you run `npx quick-fcm init`, the CLI analyses your project automatically. Here's exactly what it detects:

### Framework
| Condition | Result | Log shown |
|---|---|---|
| `next` in `dependencies` or `devDependencies` | Next.js | `✓  Detected framework: Next.js (App Router)` or `(Pages Router)` |
| `next` absent, `react` present | React | `✓  Detected framework: React` |
| Neither `next` nor `react` | **Exit** | `✖  This project does not use React or Next.js.` |

### Next.js Router Type
The CLI checks your project's folder structure:

| Folder found | Router type |
|---|---|
| `app/` directory at project root | App Router |
| `pages/` directory at project root | Pages Router |
| Neither found | Assumes App Router, logs: `ℹ  Could not detect router type. Assuming App Router.` |

### Language
- Checks for `tsconfig.json` → **TypeScript** (generates `.ts`/`.tsx` files)
- No `tsconfig.json` → **JavaScript** (generates `.js`/`.jsx` files)

### Backend Stack
- `@nestjs/core` in deps → NestJS
- `express` in deps → Express
- Neither → frontend-only

---

## Dependency Auto-Install

Before generating any files, the CLI checks whether `firebase` and `quick-fcm` are already installed in your project. If either is missing, it installs them automatically.

**Package manager detection** (checks for lockfiles):
- `pnpm-lock.yaml` → uses `pnpm`
- `yarn.lock` → uses `yarn`
- Otherwise → uses `npm`

**Versions installed:**
- `quick-fcm` — always the same version as the running CLI
- `firebase` — a tested, pinned version from the CLI's `pinnedDeps`

If you already have either package installed, it is silently skipped. If an install fails, a warning is shown and setup continues — you can install manually.

---

## Config Storage

Firebase credentials and project settings are stored in `quickfcm.config.json` at your project root — **no `.env` file is needed.** The CLI adds `quickfcm.config.json` to your `.gitignore` automatically.

The generated `config.ts`/`config.js` imports directly from this file:
```typescript
import pkg from '../../quickfcm.config.json';
export const pushConfig = { apiKey: pkg.firebase.apiKey, ... };
```

To update a credential, edit `quickfcm.config.json` directly.

---

## Generated File Structure

After a successful `init`, these files are created:

### TypeScript project (with `src/` directory)
```
public/
  firebase-messaging-sw.js            ← Service worker (background push)
src/
  components/
    PushProvider.tsx                  ← 'use client' layout wrapper (Next.js only)
  NotificationHandler/
    PushNotificationManager.tsx       ← Foreground toast handler
    config.ts                         ← Firebase config (reads from quickfcm.config.json)
    pushHelper.ts                     ← Firebase initialization hook
    USAGE.md                          ← Integration guide
quickfcm.config.json                  ← CLI configuration (auto-added to .gitignore)
```

### TypeScript project (without `src/` directory)
```
public/
  firebase-messaging-sw.js
components/
  PushProvider.tsx                    ← 'use client' layout wrapper (Next.js only)
NotificationHandler/
  PushNotificationManager.tsx
  config.ts
  pushHelper.ts
  USAGE.md
quickfcm.config.json
```

### JavaScript project
Same structure as above, using your project's existing convention:
- `.jsx` extension if your project already contains `.jsx` files (Vite / CRA style)
- `.js` extension if your project uses plain `.js` (Next.js default JS setup)

---

## Verify Installation

### Test the CLI
```bash
npx quick-fcm --help    # Shows CLI help
npx quick-fcm --version # Shows current version
npx quick-fcm init       # Starts interactive setup
```

### Check Generated Files
```bash
ls public/firebase-messaging-sw.js          # Service worker
ls src/NotificationHandler/config.ts         # TS config (or config.js for JS)
ls quickfcm.config.json                              # CLI configuration
```

---

## Troubleshooting Installation

**`command not found: quick-fcm`**
```bash
npx quick-fcm init   # No install needed with npx
# Or reinstall globally:
npm uninstall -g quick-fcm && npm install -g quick-fcm
```

**`Permission denied`**
```bash
sudo chown -R $(whoami) ~/.npm
# Or use npx (no permissions needed)
npx quick-fcm init
```

**`Node.js version too old`**
```bash
nvm install 18 && nvm use 18
```

**`package.json not found`**
```bash
cd your-react-project   # Run from project root
ls package.json          # Should exist
```

**Slow download / timeout**
```bash
npm cache clean --force
npx quick-fcm init
```

---

## IDE Integration

### VS Code
Add to `.vscode/settings.json`:
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "files.associations": {
    "*.tpl": "javascript"
  }
}
```

---

## Next Steps

After successful installation:

1. Read the **[Quick Start in README](../README.md#quick-start)** for integration steps
2. Check **`src/NotificationHandler/USAGE.md`** (generated) for copy-pasteable code
3. See **[Examples](./EXAMPLES.md)** for Next.js, React, and JavaScript patterns
4. Read **[FAQ](./FAQ.md)** for common questions

---

## Related Documentation

- [Main README](../README.md) — Full usage guide
- [API Reference](./API.md) — Detailed API documentation
- [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and solutions
- [Examples](./EXAMPLES.md) — Code examples and patterns
