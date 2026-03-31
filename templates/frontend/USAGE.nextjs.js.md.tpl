# QuickFCM — Integration Guide (Next.js · JavaScript)

Your push notification files are ready inside `{{HANDLER_DIR}}/`.

---

### 1. Config is already wired

`{{HANDLER_DIR}}/config.js` reads your Firebase credentials directly from  
`quickfcm.config.json` — **no `.env` file needed.**  
To update credentials, edit `quickfcm.config.json`.

---

### 2. Wrap your root layout with `<PushProvider>`

The CLI generated `{{COMPONENTS_DIR}}/PushProvider.{{JSX_EXT}}` for you. Add it to your root layout:

```jsx
// app/layout.jsx
import { PushProvider } from '@/components/PushProvider';

export default function RootLayout({ children }) {
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

`PushProvider` is a `'use client'` wrapper — your `layout.jsx` stays a Server Component.

---

### 3. Request permission from a button (required for Safari)

Permissions must be triggered by a user gesture:

```jsx
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

Open `{{HANDLER_DIR}}/PushNotificationManager.{{JSX_EXT}}` and connect your toast library:

```js
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

```js
import { getPushToken } from 'quick-fcm';
import { pushConfig } from '@/NotificationHandler/config';

const token = await getPushToken(pushConfig);
console.log('FCM Token:', token);
// Send this token to your backend to target this device
```
