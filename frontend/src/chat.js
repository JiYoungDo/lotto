import { useEffect, useRef } from 'react'

/**
 * 관리자 채팅 실시간 이벤트. 회원은 자기 대화, 관리자는 모든 대화의 새 메시지를 받습니다.
 * onMessage(msg) 로 호출하고, 연결이 다시 이어지면 onMessage(null) 로 한 번 호출해 놓친 메시지를 다시 불러오게 합니다.
 */
export function useChatEvents(enabled, onMessage) {
  const handler = useRef(onMessage)
  useEffect(() => { handler.current = onMessage })

  useEffect(() => {
    if (!enabled) return undefined
    const es = new EventSource('/api/chat/stream')
    let opened = false
    es.onopen = () => {
      if (opened) handler.current(null)
      opened = true
    }
    es.addEventListener('message', (ev) => handler.current(JSON.parse(ev.data)))
    return () => es.close()
  }, [enabled])
}
