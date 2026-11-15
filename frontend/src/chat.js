import { useEffect, useRef } from 'react'
import { subscribeStream } from './stream.js'
import { useAuth } from './auth.js'

/**
 * 관리자 채팅 실시간 이벤트. 회원은 자기 대화, 관리자는 모든 대화의 새 메시지를 받습니다.
 * onMessage(msg) 로 호출하고, 연결이 다시 이어지면 onMessage(null) 로 한 번 호출해 놓친 메시지를 다시 불러오게 합니다.
 * 주소에 아이디를 붙여, 다른 계정으로 다시 로그인하면 새 연결을 엽니다.
 */
export function useChatEvents(enabled, onMessage) {
  const { me } = useAuth()
  const handler = useRef(onMessage)
  useEffect(() => { handler.current = onMessage })
  const user = me?.loggedIn ? me.username : null

  useEffect(() => {
    if (!enabled || !user) return undefined
    return subscribeStream(`/api/chat/stream?u=${encodeURIComponent(user)}`, ['message'], (name, data) => {
      handler.current(name === 'reconnect' ? null : data)
    })
  }, [enabled, user])
}
