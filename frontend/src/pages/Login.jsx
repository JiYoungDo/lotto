import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.js'

// 로그인 화면: 관리자로 로그인하면 관리자 화면, 아니면 회차 번호 화면으로 이동
export default function Login() {
  const { me, signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // 이미 로그인했으면 바로 이동
  if (me?.loggedIn && !busy) return <Navigate to={me.admin ? '/admin' : '/draws'} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const m = await signIn(username, password)
      navigate(m.admin ? '/admin' : '/draws', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="section band-soft">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="section-head">
          <h2 className="display-sm">로그인</h2>
          <p>관리자로 로그인하면 회차 등록·수정·삭제를 할 수 있는 관리자 화면으로 이동합니다. 회차 번호와 가설 분석은 로그인 없이 볼 수 있습니다.</p>
        </div>
        <div className="feature-card">
          <form onSubmit={onSubmit} style={{ marginTop: 0 }}>
            <div>
              <label className="field-label" htmlFor="username">아이디</label>
              <input className="input" id="username" autoComplete="username" required autoFocus
                     value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="password">비밀번호</label>
              <input className="input" id="password" type="password" autoComplete="current-password" required
                     value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
          </form>
          {error && <p className="notice">{error}</p>}
          <p className="form-foot">계정이 없나요? <Link to="/signup">회원가입</Link></p>
        </div>
      </div>
    </section>
  )
}
