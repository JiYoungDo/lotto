import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.js'
import { NotifyContext } from '../notify.js'
import { useChatEvents } from '../chat.js'
import { fetchChatUnread } from '../api.js'

const TOAST_MS = 7000
const BASE_TITLE = 'LottoLab'
const supported = typeof window !== 'undefined' && 'Notification' in window

/**
 * 채팅 알림: 어느 화면에 있든 새 메시지가 오면
 *  - 상단 🔔 배지(안 읽은 수)와 탭 제목 "(n)" 갱신
 *  - 화면 구석 팝업(토스트)
 *  - 다른 탭을 보고 있으면 브라우저 알림 (허용한 경우)
 * 지금 그 대화를 보고 있으면 팝업·브라우저 알림은 띄우지 않습니다.
 */
export default function NotificationProvider({ children }) {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [count, setUnread] = useState(0)
  const [toasts, setToasts] = useState([])
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')
  const viewing = useRef(null) // 'me' (회원 채팅) 또는 회원 id (관리자가 연 대화)
  const loggedIn = !!me?.loggedIn
  const admin = !!me?.admin
  const unread = loggedIn ? count : 0 // 로그아웃하면 바로 0

  const refreshUnread = useCallback(() => {
    if (!loggedIn) return
    fetchChatUnread().then((d) => setUnread(d.count)).catch(() => {})
  }, [loggedIn])

  useEffect(() => { refreshUnread() }, [refreshUnread, me?.username])

  // 탭 제목에 안 읽은 수
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE
  }, [unread])

  const setViewing = useCallback((v) => { viewing.current = v }, [])

  const linkFor = (m) => (admin ? { to: '/admin?tab=winners', state: { openChat: m.memberId } } : { to: '/mypage#chat' })
  const open = (link) => navigate(link.to, { state: link.state })
  const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id))

  useChatEvents(loggedIn, (m) => {
    if (!m) { refreshUnread(); return }
    const incoming = admin ? !m.fromAdmin : m.fromAdmin // 상대가 보낸 메시지만 알림
    // 대화를 보고 있는 화면이 읽음 처리할 시간을 조금 준 뒤 서버 기준 안 읽은 수를 다시 가져옴
    setTimeout(refreshUnread, 600)
    if (!incoming) return

    const watching = !document.hidden && (admin ? viewing.current === m.memberId : viewing.current === 'me')
    if (watching) return

    const title = admin ? `${m.sender}님의 새 메시지` : '관리자의 새 메시지'
    const body = m.content.length > 80 ? `${m.content.slice(0, 80)}…` : m.content
    const link = linkFor(m)

    const id = `${m.id}-${Date.now()}`
    setToasts((list) => [...list.slice(-2), { id, title, body, link }])
    setTimeout(() => dismiss(id), TOAST_MS)

    if (document.hidden && supported && Notification.permission === 'granted') {
      const n = new Notification(title, { body, tag: `chat-${m.memberId}` })
      n.onclick = () => { window.focus(); open(link); n.close() }
    }
  })

  const requestPermission = async () => {
    if (!supported) return
    const p = await Notification.requestPermission()
    setPermission(p)
  }

  return (
    <NotifyContext.Provider value={{ unread, refreshUnread, setViewing, permission, requestPermission }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">
            <button type="button" className="toast-body" onClick={() => { open(t.link); dismiss(t.id) }}>
              <span className="toast-title">💬 {t.title}</span>
              <span className="toast-text">{t.body}</span>
            </button>
            <button type="button" className="toast-close" aria-label="알림 닫기" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  )
}
