import { useEffect, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, onMessage } from 'firebase/messaging'
import { PushConfig, PushMessage } from './types'
import { getPushToken } from './getPushToken'

interface UsePushOptions {
  config: PushConfig
  onMessage?: (message: PushMessage) => void
  onTokenChange?: (token: string) => void
}

export function usePush({ config, onMessage: onMsg, onTokenChange }: UsePushOptions) {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    ;(async () => {
      const app = getApps().length ? getApps()[0] : initializeApp(config)
      const messaging = getMessaging(app)

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const token = await getPushToken(config)

      if (token) {
        onTokenChange?.(token)

        // Register token with backend if URL provided
        if (config.registerUrl) {
          await fetch(config.registerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          }).catch(() => {})
        }
      }

      onMessage(messaging, (payload) => {
        console.log('[custom-push] Foreground message (hook) received:', payload)

        const messageUrl = 
             payload.data?.action_url 
          || payload.data?.url 
          || payload.data?.route 
          || payload.data?.click_action 
          || (payload as any).fcmOptions?.link

        const message: PushMessage = {
          id: Date.now().toString(),
          title: payload.notification?.title || payload.data?.title || '',
          body: payload.notification?.body || payload.data?.body || '',
          icon: payload.notification?.icon || payload.data?.icon,
          url: messageUrl,
          data: payload.data as Record<string, string> | undefined,
          payload: payload,
          timestamp: Date.now(),
        }
        onMsg?.(message)
      })
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
