import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { signUp } from '../api.js'
import { useAuth } from '../auth.js'
import Disclaimer from '../components/Disclaimer.jsx'

const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/

// 회원가입: 가입하면 DB(member 테이블)에 일반 회원으로 저장되고 바로 로그인됩니다.
export default function SignUp() {
  const { me, signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [adult, setAdult] = useState(false)   // 만 19세 이상 확인 (필수)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (me?.loggedIn && !busy) return <Navigate to={me.admin ? '/admin' : '/mypage'} replace />

  const nameOk = USERNAME_RE.test(username)
  const pwOk = password.length >= 8 && password.length <= 64
  const sameOk = confirm === password
  const valid = nameOk && pwOk && sameOk && adult

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await signUp(username, password, adult)
      await signIn(username, password)
      navigate('/mypage', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="section band-soft">
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="section-head">
          <h2 className="display-sm">회원가입</h2>
          <p>가입하면 바로 로그인됩니다. 회차 등록은 관리자만 할 수 있습니다.</p>
        </div>
        <div className="feature-card">
          <form onSubmit={onSubmit} style={{ marginTop: 0 }} noValidate>
            <div>
              <label className="field-label" htmlFor="su-username">아이디</label>
              <input className="input" id="su-username" autoComplete="username" required autoFocus maxLength={20}
                     value={username} onChange={(e) => setUsername(e.target.value.trim())} />
              <p className={'field-hint' + (username && !nameOk ? ' bad' : '')}>영문·숫자·밑줄(_)로 4~20자</p>
            </div>
            <div>
              <label className="field-label" htmlFor="su-password">비밀번호</label>
              <input className="input" id="su-password" type="password" autoComplete="new-password" required maxLength={64}
                     value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className={'field-hint' + (password && !pwOk ? ' bad' : '')}>8~64자</p>
            </div>
            <div>
              <label className="field-label" htmlFor="su-confirm">비밀번호 확인</label>
              <input className="input" id="su-confirm" type="password" autoComplete="new-password" required maxLength={64}
                     value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {confirm && !sameOk && <p className="field-hint bad">비밀번호가 일치하지 않습니다.</p>}
            </div>
            <Disclaimer />
            <label className="check adult-check">
              <input type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span><b>만 19세 이상입니다.</b> <span className="req">(필수)</span></span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy || !valid}>{busy ? '가입 중…' : '가입하기'}</button>
          </form>
          {error && <p className="notice">{error}</p>}
          <p className="form-foot">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
        </div>
      </div>
    </section>
  )
}
