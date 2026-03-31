# QuickFCM — Integration Guide (Next.js · TypeScript)

Your push notification files are ready inside `src/NotificationHandler/`.

---

### 1. Config is already wired

`src/NotificationHandler/config.ts` reads your Firebase credentials directly from  
`quickfcm.config.json` — **no `.env` file needed.**  
To update credentials, edit `quickfcm.config.json`.

---

### 2. Wrap your root layout with `<PushProvider>`

The CLI generated `components/PushProvider.tsx` for you. Add it to your root layout:

```tsx
// app/layout.tsx
import { PushProvider } from '@/components/PushProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PushProvider>
          {children}
        </PushProvider>
      </body>
    </html>
  );
}
```

`PushProvider` is a `'use client'` wrapper — your `layout.tsx` stays a Server Component.

---

### 3. Request permission from a button (required for Safari)

Permissions must be triggered by a user gesture:

```tsx
'use client';
import { usePushMessage } from 'quick-fcm';

export function EnablePushButton() {
  const { isPermissionGranted, requestPermission } = usePushMessage();

  return (
    <button onClick={requestPermission} disabled={isPermissionGranted}>
      {isPermissionGranted ? '✓ Notifications enabled' : 'Enable Notifications'}
    </button>
  );
}
```

---

### 4. Handle foreground messages

Open `src/NotificationHandler/PushNotificationManager.tsx` and connect your toast library:

```ts
// Replace the console.log with your toast library
useEffect(() => {
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    toast(last.title, { description: last.body }); // Sonner, react-hot-toast, etc.
  }
}, [messages]);
```

---

### 5. Get the raw FCM token

```ts
import { getPushToken } from 'quick-fcm';
import { pushConfig } from '@/NotificationHandler/config';

const token = await getPushToken(pushConfig);
console.log('FCM Token:', token);
// Send this token to your backend to target this device
```
