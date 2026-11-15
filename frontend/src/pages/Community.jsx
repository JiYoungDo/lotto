import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { writePost, deletePost } from '../api.js'
import { useAuth } from '../auth.js'
import { useCommunity, formatTime } from '../community.js'

// 커뮤니티: 실시간 대화. 최신 100개 글만 서버에 남고 오래된 글은 자동으로 지워집니다.
export default function Community() {
  const { me, refresh } = useAuth()
  const { posts, meta, online, connected, error, addLocal, removeLocal } = useCommunity()
  const [text, setText] = useState('')
  const [msg, setMsg] = useState(null)
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)
  const stick = useRef(true) // 맨 아래를 보고 있으면 새 글이 올 때 자동으로 내려감

  const onScroll = () => {
    const el = listRef.current
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [posts])
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t) } }, [msg])

  const send = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const p = await writePost(content)
      stick.current = true
      addLocal(p)
      setText('')
    } catch (e) {
      setMsg(e.message)
      if (e.status === 401) await refresh()
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e) => {
    // 한글 입력 중(조합 중) Enter는 무시해야 마지막 글자가 두 번 보내지지 않음
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  const onDelete = async (p) => {
    if (!window.confirm('이 글을 지울까요?')) return
    try {
      await deletePost(p.id)
      removeLocal(p.id)
    } catch (e) {
      setMsg(e.message)
    }
  }

  const left = meta.maxLength - text.length

  return (
    <section className="section band-soft">
      <div className="container community">
        <div className="community-head">
          <div>
            <h1 className="display-sm">커뮤니티</h1>
            <p className="caption" style={{ marginTop: 6 }}>
              <span className={'live-dot' + (connected ? ' on' : '')} />
              {connected ? `실시간 연결됨 · 지금 ${online}명 보는 중` : '연결 중…'}
            </p>
          </div>
        </div>

        <div className="volatile-notice" role="note">
          <strong>글은 오래 보관되지 않습니다.</strong>
          <span>
            커뮤니티에는 최신 글 {meta.max}개만 저장되고, 새 글이 올라오면 가장 오래된 글부터 자동으로 사라집니다.
            지워진 글은 되살릴 수 없으니 중요한 내용은 따로 저장해 두세요. 개인정보는 올리지 마세요.
          </span>
        </div>

        <div className="chat-card">
          <div className="chat-list" ref={listRef} onScroll={onScroll} aria-live="polite">
            {error && <p className="empty">글을 불러오지 못했어요: {error}</p>}
            {!posts && !error && <p className="empty">불러오는 중…</p>}
            {posts && posts.length === 0 && <p className="empty">아직 글이 없습니다. 첫 글을 남겨 보세요.</p>}
            {posts && posts.map((p) => {
              const mine = me?.loggedIn && p.author === me.username
              return (
                <div key={p.id} className={'chat-msg' + (mine ? ' mine' : '')}>
                  <div className="chat-meta">
                    <b>{p.author}</b>
                    {p.admin && <span className="role-badge admin">관리자</span>}
                    <span className="num">{formatTime(p.createdAt)}</span>
                    {(mine || me?.admin) && (
                      <button type="button" className="chat-del" onClick={() => onDelete(p)} aria-label="글 지우기">지우기</button>
                    )}
                  </div>
                  <div className="chat-bubble">{p.content}</div>
                </div>
              )
            })}
          </div>

          {me?.loggedIn ? (
            <div className="chat-compose">
              <textarea className="input" rows={2} maxLength={meta.maxLength} placeholder="메시지를 입력하세요 (Enter 보내기, Shift+Enter 줄바꿈)"
                        value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} aria-label="메시지" />
              <div className="chat-compose-side">
                <span className={'caption' + (left < 50 ? ' warn' : '')}>{left}</span>
                <button className="btn btn-primary" type="button" onClick={send} disabled={sending || !text.trim()}>보내기</button>
              </div>
            </div>
          ) : (
            <div className="chat-compose guest">
              <span>글을 쓰려면 로그인하세요. 읽기는 누구나 할 수 있습니다.</span>
              <div className="form-actions">
                <Link className="btn btn-secondary btn-sm" to="/signup">회원가입</Link>
                <Link className="btn btn-primary btn-sm" to="/login">로그인</Link>
              </div>
            </div>
          )}
        </div>
        {msg && <p className="notice">{msg}</p>}
      </div>
    </section>
  )
}
