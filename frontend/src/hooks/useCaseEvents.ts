import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import { getAccessToken, isDemoActive } from '../api/client'
import type { CaseEventMessage } from '../api/types'
import { useAuth } from '../auth/AuthContext'

function wsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (import.meta.env.VITE_API_BASE_URL) return `${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '')}/ws`
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

/** Live connection state for the case queue's STOMP subscription. */
export type LiveState = 'off' | 'demo' | 'connecting' | 'live' | 'reconnecting'

export function useCaseEvents(onEvent: (message: CaseEventMessage) => void) {
  const { session, isAuthenticated, isDemo } = useAuth()
  const handler = useRef(onEvent)
  handler.current = onEvent
  const [state, setState] = useState<LiveState>('off')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !session?.tenantId) {
      setState('off')
      return
    }
    if (isDemo || isDemoActive()) {
      setState('demo')
      return
    }

    const token = getAccessToken()
    if (!token || token.startsWith('demo.')) {
      setState('off')
      return
    }

    setState('connecting')
    const client = new Client({
      brokerURL: wsUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 4000,
      onConnect: () => {
        setState('live')
        client.subscribe(`/topic/tenants.${session.tenantId}.cases`, (frame) => {
          try {
            const body = JSON.parse(frame.body) as CaseEventMessage
            setLastEventAt(Date.now())
            handler.current(body)
          } catch {
            // ignore malformed frames
          }
        })
      },
      onWebSocketClose: () => setState((s) => (s === 'off' ? s : 'reconnecting')),
      onWebSocketError: () => setState('reconnecting'),
      onStompError: () => setState('reconnecting'),
    })

    client.activate()
    return () => {
      setState('off')
      void client.deactivate()
    }
  }, [isAuthenticated, isDemo, session?.tenantId])

  return { state, lastEventAt }
}
