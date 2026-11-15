import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { changePassword } from '../api.js'
import { useAuth } from '../auth.js'

// 내 정보: 비밀번호 변경
export default function Account() {
  const { me } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!me) return null
  if (!me.loggedIn) return <Navigate to="/login" replace />

  const pwOk = next.length >= 8 && next.length <= 64
  const valid = current && pwOk && next === confirm

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      const r = await changePassword(current, next)
      setMsg(r.message)
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section band-soft">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="section-head">
          <h2 className="display-sm">내 정보</h2>
          <p><b>{me.username}</b> · {me.admin ? '관리자' : '일반 회원'}</p>
        </div>
        <div className="feature-card">
          <div className="title-md">비밀번호 변경</div>
          <form onSubmit={onSubmit} noValidate>
            <div>
              <label className="field-label" htmlFor="cur">현재 비밀번호</label>
              <input className="input" id="cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="new">새 비밀번호</label>
              <input className="input" id="new" type="password" autoComplete="new-password" maxLength={64} value={next} onChange={(e) => setNext(e.target.value)} />
              <p className={'field-hint' + (next && !pwOk ? ' bad' : '')}>8~64자</p>
            </div>
            <div>
              <label className="field-label" htmlFor="new2">새 비밀번호 확인</label>
              <input className="input" id="new2" type="password" autoComplete="new-password" maxLength={64} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {confirm && next !== confirm && <p className="field-hint bad">비밀번호가 일치하지 않습니다.</p>}
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !valid}>바꾸기</button>
          </form>
          {msg && <p className="notice">{msg}</p>}
        </div>
      </div>
    </section>
  )
}
