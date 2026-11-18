import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { changeNickname, changePassword, withdraw } from '../api.js'
import { useAuth } from '../auth.js'
import { NICKNAME_RE, useAvailability } from '../availability.js'
import AvailHint from '../components/AvailHint.jsx'

// 내 정보: 닉네임 변경, 비밀번호 변경, 회원 탈퇴
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
          <p><b>{me.nickname || me.username}</b> · 아이디 {me.username} · {me.admin ? '관리자' : '일반 회원'}</p>
        </div>
        <NicknameCard />
        <div className="feature-card" style={{ marginTop: 20 }}>
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
        {!me.admin && <WithdrawCard />}
      </div>
    </section>
  )
}

// 회원 탈퇴: 비밀번호를 다시 입력하고, 되돌릴 수 없다는 확인을 받은 뒤 진행
function WithdrawCard() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [deletePosts, setDeletePosts] = useState(false)
  const [sure, setSure] = useState(false)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!password || !sure) return
    setBusy(true)
    try {
      const r = await withdraw(password, deletePosts)
      await refresh()
      alert(r.message)
      navigate('/draws', { replace: true })
    } catch (err) {
      setMsg(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="feature-card withdraw-card" style={{ marginTop: 20 }}>
      <div className="title-md">회원 탈퇴</div>
      {!open ? (
        <>
          <p className="caption">탈퇴하면 계정과 기록이 지워지고 되살릴 수 없어요.</p>
          <button className="btn btn-danger" type="button" onClick={() => setOpen(true)}>탈퇴하기</button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <ul className="withdraw-list">
            <li>계정, 저장한 번호와 메모, 관리자와의 1:1 채팅, 게임 점수가 <b>바로 삭제</b>되고 되살릴 수 없어요.</li>
            <li>커뮤니티 글은 아래에서 함께 지우지 않으면 작성자가 ‘(탈퇴한 회원)’으로 표시된 채 남아요.</li>
            <li>같은 아이디로 다시 가입할 수 있어요. 자세한 내용은 <Link to="/privacy">개인정보 처리방침</Link>을 확인하세요.</li>
          </ul>
          <div>
            <label className="field-label" htmlFor="wd-pw">비밀번호 확인</label>
            <input className="input" id="wd-pw" type="password" autoComplete="current-password" value={password}
                   onChange={(e) => { setPassword(e.target.value); setMsg(null) }} />
          </div>
          <label className="check adult-check">
            <input type="checkbox" checked={deletePosts} onChange={(e) => setDeletePosts(e.target.checked)} />
            <span>내가 쓴 커뮤니티 글도 모두 지웁니다.</span>
          </label>
          <label className="check adult-check">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
            <span><b>위 내용을 확인했고, 탈퇴합니다.</b></span>
          </label>
          <div className="withdraw-actions">
            <button className="btn btn-danger" type="submit" disabled={busy || !password || !sure}>{busy ? '탈퇴 중…' : '탈퇴하기'}</button>
            <button className="btn btn-secondary" type="button" disabled={busy}
                    onClick={() => { setOpen(false); setPassword(''); setSure(false); setDeletePosts(false); setMsg(null) }}>취소</button>
          </div>
        </form>
      )}
      {msg && <p className="notice">{msg}</p>}
    </div>
  )
}

// 닉네임 변경: 커뮤니티 글과 게임 순위에 바로 반영됩니다 (지난 글도 새 닉네임으로 보임)
function NicknameCard() {
  const { me, refresh } = useAuth()
  const [nickname, setNickname] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const formatOk = NICKNAME_RE.test(nickname)
  const same = nickname === me.nickname
  const free = useAvailability('nickname', nickname, formatOk && !same)
  const valid = formatOk && !same && free?.ok !== false

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      const r = await changeNickname(nickname)
      await refresh()   // 헤더 등에 보이는 내 닉네임도 바로 바뀜
      setMsg(r.message)
      setNickname('')
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="feature-card">
      <div className="title-md">닉네임 변경</div>
      <p className="caption">지금 닉네임 <b>{me.nickname}</b> · 커뮤니티 글과 게임 순위에 보이는 이름이에요. 지난 글에도 새 닉네임이 보입니다.</p>
      <form onSubmit={onSubmit} noValidate>
        <div>
          <label className="field-label" htmlFor="nick">새 닉네임</label>
          <input className="input" id="nick" autoComplete="nickname" maxLength={12} value={nickname}
                 onChange={(e) => { setNickname(e.target.value.trim()); setMsg(null) }} />
          {same && nickname
            ? <p className="field-hint bad">지금 쓰는 닉네임과 같습니다.</p>
            : <AvailHint input={nickname} formatOk={formatOk} free={free} rule="한글·영문·숫자·밑줄(_)로 2~12자" okText="사용할 수 있는 닉네임이에요." />}
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !valid}>{busy ? '바꾸는 중…' : '닉네임 바꾸기'}</button>
      </form>
      {msg && <p className="notice">{msg}</p>}
    </div>
  )
}
