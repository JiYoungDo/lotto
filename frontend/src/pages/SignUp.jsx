import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { signUp } from '../api.js'
import { useAuth } from '../auth.js'
import Disclaimer from '../components/Disclaimer.jsx'
import AvailHint from '../components/AvailHint.jsx'
import { NICKNAME_RE, useAvailability } from '../availability.js'

const USERNAME_RE = /^[a-zA-Z0-9_]{4,20}$/

// 회원가입: 가입하면 DB(member 테이블)에 일반 회원으로 저장되고 바로 로그인됩니다.
export default function SignUp() {
  const { me, signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [adult, setAdult] = useState(false)   // 만 19세 이상 확인 (필수)
  const [agreeTerms, setAgreeTerms] = useState(false)     // 이용약관 동의 (필수)
  const [agreePrivacy, setAgreePrivacy] = useState(false) // 개인정보 수집·이용 동의 (필수)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const nameOk = USERNAME_RE.test(username)
  const nickOk = NICKNAME_RE.test(nickname)
  const nameFree = useAvailability('username', username, nameOk)
  const nickFree = useAvailability('nickname', nickname, nickOk)

  if (me?.loggedIn && !busy) return <Navigate to={me.admin ? '/admin' : '/mypage'} replace />

  const pwOk = password.length >= 8 && password.length <= 64
  const sameOk = confirm === password
  // 중복 확인 결과가 '사용 중'이면 막음 (확인 전이면 서버가 가입할 때 한 번 더 확인)
  const valid = nameOk && nickOk && nameFree?.ok !== false && nickFree?.ok !== false && pwOk && sameOk && adult && agreeTerms && agreePrivacy

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await signUp(username, nickname, password, adult, agreeTerms, agreePrivacy)
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
              <AvailHint input={username} formatOk={nameOk} free={nameFree} rule="영문·숫자·밑줄(_)로 4~20자 · 로그인할 때 씁니다" okText="사용할 수 있는 아이디예요." />
            </div>
            <div>
              <label className="field-label" htmlFor="su-nickname">닉네임</label>
              <input className="input" id="su-nickname" autoComplete="nickname" required maxLength={12}
                     value={nickname} onChange={(e) => setNickname(e.target.value.trim())} />
              <AvailHint input={nickname} formatOk={nickOk} free={nickFree} rule="한글·영문·숫자·밑줄(_)로 2~12자 · 커뮤니티와 게임 순위에 보입니다" okText="사용할 수 있는 닉네임이에요." />
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
            <label className="check adult-check">
              <input type="checkbox" required checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
              <span><Link to="/terms" target="_blank">이용약관</Link>에 동의합니다. <span className="req">(필수)</span></span>
            </label>
            <label className="check adult-check">
              <input type="checkbox" required checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
              <span>아이디·닉네임·비밀번호 수집·이용에 동의합니다. <Link to="/privacy" target="_blank">자세히</Link> <span className="req">(필수)</span></span>
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
