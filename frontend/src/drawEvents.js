import { useEffect, useRef } from 'react'
import { subscribeStream } from './stream.js'

/**
 * 관리자가 회차(당첨 번호)를 등록·수정·삭제·업로드하면 서버가 알려주는 실시간 이벤트를 받습니다.
 * onChange({ action, round }) 가 호출되며, 연결이 끊겼다 다시 이어지면 놓친 변경이 있을 수 있어
 * { action: 'reconnect' } 로도 한 번 호출합니다.
 */
export function useDrawEvents(onChange) {
  const handler = useRef(onChange)
  useEffect(() => { handler.current = onChange })

  useEffect(() => subscribeStream('/api/draws/stream', ['draw'], (name, data) => {
    handler.current(name === 'reconnect' ? { action: 'reconnect' } : data)
  }), [])
}
