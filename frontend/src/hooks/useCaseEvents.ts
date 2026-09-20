import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import { getAccessToken } from '../api/client'
import type { CaseEventMessage } from '../api/types'
import { useAuth } from '../auth/AuthContext'

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

export function useCaseEvents(onEvent: (message: CaseEventMessage) => void) {
  const { session, isAuthenticated } = useAuth()
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    if (!isAuthenticated || !session?.tenantId) return

    const token = getAccessToken()
    if (!token) return

    const client = new Client({
      brokerURL: wsUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 4000,
      onConnect: () => {
        client.subscribe(`/topic/tenants.${session.tenantId}.cases`, (frame) => {
          try {
            const body = JSON.parse(frame.body) as CaseEventMessage
            handler.current(body)
          } catch {
            // ignore malformed frames
          }
        })
      },
    })

    client.activate()
    return () => {
      void client.deactivate()
    }
  }, [isAuthenticated, session?.tenantId])
}
