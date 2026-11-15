import { useLayoutEffect, useRef, useState } from 'react'
import { formatTime } from '../community.js'

/**
 * 1:1 대화창. viewerIsAdmin 기준으로 내 메시지는 오른쪽(파랑), 상대 메시지는 왼쪽에 보입니다.
 * onSend(content) 는 Promise를 돌려주며, 실패하면 오류 메시지를 보여줍니다.
 */
export default function ChatThread({ messages, viewerIsAdmin, onSend, maxLength = 1000, placeholder, emptyText }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const listRef = useRef(null)

  useLayoutEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    try {
      await onSend(content)
      setText('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-card dm">
      <div className="chat-list dm-list" ref={listRef} aria-live="polite">
        {messages.length === 0 && <p className="empty">{emptyText || '아직 대화가 없습니다.'}</p>}
        {messages.map((m) => {
          const mine = m.fromAdmin === viewerIsAdmin
          const who = m.fromAdmin ? (viewerIsAdmin ? m.sender : '관리자') : m.sender
          return (
            <div key={m.id} className={'chat-msg' + (mine ? ' mine' : '')}>
              <div className="chat-meta">
                <b>{who}</b>
                {m.fromAdmin && <span className="role-badge admin">관리자</span>}
                <span className="num">{formatTime(m.createdAt)}</span>
              </div>
              <div className="chat-bubble">{m.content}</div>
            </div>
          )
        })}
      </div>
      <div className="chat-compose">
        <textarea className="input" rows={2} maxLength={maxLength} value={text} aria-label="메시지"
                  placeholder={placeholder || '메시지를 입력하세요 (Enter 보내기, Shift+Enter 줄바꿈)'}
                  onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} />
        <div className="chat-compose-side">
          <span className="caption">{maxLength - text.length}</span>
          <button className="btn btn-primary" type="button" onClick={send} disabled={sending || !text.trim()}>보내기</button>
        </div>
      </div>
      {error && <p className="notice" style={{ margin: '0 20px 16px' }}>{error}</p>}
    </div>
  )
}
