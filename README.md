# Custom Push CLI

> Professional backend scaffolding for Firebase Cloud Messaging with seamless React integration

[![npm version](https://badge.fury.io/js/custom-push.svg)](https://badge.fury.io/js/custom-push)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

Custom Push is a production-grade CLI tool that scaffolds robust Firebase Cloud Messaging (FCM) infrastructure. It focuses on zero-fluff backend scaffolding (Express/NestJS) while providing an elite React package for frontend integration, including full support for **Next.js App Router**.

## Features

- **Backend-focused** - Scaffolds production-grade `FCMHelper` and routes
- **Package-based Frontend** - Core logic handled by the `custom-push` React package
- **App Router Support** - Fully compatible with Next.js 13+ (includes `'use client'` directives)
- **Flexible Workflows** - Support for Backend-only, Package-based, or full Boilerplate generation
- **Service Worker Engine** - Integrated on-demand service worker registration
- **Proactive Validation** - Mandatory dependency checks for both `firebase-admin` and `firebase`
- **Minimal Prompts** - Intelligent project detection reduces setup to maximum 4 questions

## Quick Start

### 1. Initialize
```bash
# Recommended for most projects
npx custom-push init
```

### 2. Specialized Flows
```bash
# Backend-only engine (Zero frontend fluff)
npx custom-push init --backend-only

# Maximum control (Full source-code generation)
npx custom-push init --generate-frontend
```

## Frontend Integration (React / Next.js)

### 1. Install the package
```bash
npm install custom-push
```

### 2. Wrap your application
```typescript
import { CustomPushProvider } from 'custom-push';

const pushConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
  vapidKey: "your-vapid-key"
};

function Root() {
  return (
    <CustomPushProvider config={pushConfig}>
      <App />
    </CustomPushProvider>
  );
}
```

### 3. Use the hook
```typescript
import { usePushMessage } from 'custom-push';

function App() {
  const { requestPermission, token, messages } = usePushMessage();

  return (
    <div>
      <button onClick={() => requestPermission()}>
        Enable Notifications
      </button>
      {token && <p>Token ready: {token.slice(0, 10)}...</p>}
    </div>
  );
}
```

## Backend Scaffolding

The CLI generates a high-performance `FCMHelper` in your `src/helper/` directory.

```typescript
import { sendPushNotification } from './helper/FCMHelper';

await sendPushNotification({
  token: 'user-device-token',
  title: 'Order Shipped!',
  body: 'Your package is on its way.',
  route: '/orders/123',
  icon: '/icons/shipping-192.png'
});
```

## Configuration

All local configuration is stored in `our_pkg.json`. This acts as the single source of truth for both your CLI and runtime integration.

```json
{
  "stack": {
    "language": "typescript",
    "scope": "both",
    "backendFramework": "express"
  },
  "firebase": {
    "apiKey": "...",
    "vapidKey": "..."
  },
  "backend": {
    "registerUrl": "http://localhost:3000/push/register"
  }
}
```

## Requirements

- **Node.js**: >= 18.0.0
- **Frameworks**: Express, NestJS, Next.js, Vite, CRA
- **Firebase**: Free or Blaze tier project

## Documentation

- **[Installation Guide](./docs/INSTALLATION.md)** - Detailed system requirements and setup
- **[Architecture Overview](./docs/ARCHITECTURE.md)** - Understanding the Elite workflow
- **[API Reference](./docs/API.md)** - Detailed provider and helper documentation
- **[Examples](./docs/EXAMPLES.md)** - Real-world patterns (Next.js, Auth, etc.)
- **[FAQ](./docs/FAQ.md)** - Common questions and troubleshooting

## License

MIT © [Your Name]

---

**Made with ❤️ for the React & Node.js communities**
