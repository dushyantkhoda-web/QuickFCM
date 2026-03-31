# QuickFCM — Integration Guide (React · JavaScript)

Your push notification files are ready inside `{{HANDLER_DIR}}/`.

---

### 1. Config is already wired

`{{HANDLER_DIR}}/config.js` reads your Firebase credentials directly from  
`quickfcm.config.json` — **no `.env` file needed.**  
To update credentials, edit `quickfcm.config.json`.

---

### 2. Wrap your App root with `<CustomPushProvider>`

```jsx
// src/main.jsx or src/index.jsx
import { CustomPushProvider } from 'quick-fcm';
import { pushConfig } from './NotificationHandler/config';
import { PushNotificationManager } from './NotificationHandler/PushNotificationManager';

ReactDOM.createRoot(document.getElementById('root')).render(
  <CustomPushProvider config={pushConfig}>
    <PushNotificationManager />
    <App />
  </CustomPushProvider>
);
```

Or wrap inside `App.jsx`:

```jsx
// src/App.jsx
import { CustomPushProvider } from 'quick-fcm';
import { pushConfig } from './NotificationHandler/config';
import { PushNotificationManager } from './NotificationHandler/PushNotificationManager';

function App() {
  return (
    <CustomPushProvider config={pushConfig}>
      <PushNotificationManager />
      {/* rest of your app */}
    </CustomPushProvider>
  );
}
```

---

### 3. Request permission from a button (required for Safari)

Permissions must be triggered by a user gesture:

```jsx
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
import { pushConfig } from './NotificationHandler/config';

const token = await getPushToken(pushConfig);
console.log('FCM Token:', token);
// Send this token to your backend to target this device
```
