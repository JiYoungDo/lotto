import { useState } from 'react'
import { Link } from 'react-router-dom'
import { agreeTerms } from '../api.js'
import { useAuth } from '../auth.js'
import { EFFECTIVE } from '../legal.js'

// 지금 약관에 아직 동의하지 않은 기존 회원에게, 다른 화면 대신 보여 주는 동의 화면
export default function TermsGate() {
  const { me, refresh, signOut } = useAuth()
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!terms || !privacy) return
    setBusy(true)
    try {
      await agreeTerms()
      await refresh()   // termsRequired 가 풀리면 원래 화면이 보임
    } catch (err) {
      setMsg(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="section band-soft">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="section-head">
          <h1 className="display-sm">약관 동의가 필요해요</h1>
          <p>{me.nickname || me.username}님, {EFFECTIVE}부터 시행되는 이용약관과 개인정보 처리방침에 동의해 주셔야 계속 이용할 수 있어요. 동의하면 바로 보던 화면으로 돌아가요.</p>
        </div>
        <div className="feature-card">
          <form onSubmit={onSubmit} noValidate>
            <label className="check adult-check">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span><Link to="/terms" target="_blank">이용약관</Link>에 동의합니다. <span className="req">(필수)</span></span>
            </label>
            <label className="check adult-check">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
              <span>개인정보 수집·이용에 동의합니다. <Link to="/privacy" target="_blank">자세히</Link> <span className="req">(필수)</span></span>
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy || !terms || !privacy}>{busy ? '처리 중…' : '동의하고 계속하기'}</button>
          </form>
          {msg && <p className="notice">{msg}</p>}
          <p className="form-foot">
            동의하지 않으려면 <button className="link-btn" type="button" onClick={signOut}>로그아웃</button>하거나{' '}
            <Link to="/account">내 정보</Link>에서 탈퇴할 수 있어요.
          </p>
        </div>
      </div>
    </section>
  )
}
