import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.js'
import { useNotify } from '../notify.js'
import Disclaimer from './Disclaimer.jsx'

export default function Layout() {
  const cls = ({ isActive }) => (isActive ? 'active' : '')
  const { me, signOut } = useAuth()
  const { unread } = useNotify()
  const admin = me?.admin
  const navigate = useNavigate()
  const onSignOut = async () => {
    await signOut()
    navigate('/draws')
  }
  return (
    <>
      <header className="top-nav">
        <div className="container nav-inner">
          <Link className="wordmark" to="/draws">
            <img src="/logo.svg" alt="로또 연구소" height="28" />
            <span className="wordmark-tag">번호 기록·분석 도구</span>
          </Link>
          <nav className="nav-links">
            <NavLink to="/draws" className={cls}>회차 번호</NavLink>
            <NavLink to="/analysis" className={cls}>가설 분석</NavLink>
            <NavLink to="/community" className={cls}>커뮤니티</NavLink>
            {me?.loggedIn && <NavLink to="/mypage" className={cls}>마이페이지</NavLink>}
            {admin && <NavLink to="/admin" className={cls}>관리자</NavLink>}
          </nav>
          {/* 로그인 상태 확인 전(me === null)에는 버튼을 잠시 숨김 */}
          {me && (
            <div className="nav-auth">
              {me.loggedIn ? (
                <>
                  <Link className={'nav-bell' + (unread > 0 ? ' has' : '')} to={admin ? '/admin?tab=winners' : '/mypage#chat'}
                        title={unread > 0 ? `안 읽은 채팅 ${unread}개` : '채팅 알림'} aria-label={`채팅 알림, 안 읽은 메시지 ${unread}개`}>
                    🔔{unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
                  </Link>
                  <Link className="nav-user" to="/account" title={`내 정보 (아이디 ${me.username})`}>{me.nickname || me.username}{admin && <span className="badge">관리자</span>}</Link>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={onSignOut}>로그아웃</button>
                </>
              ) : (
                <>
                  <Link className="nav-text" to="/signup">회원가입</Link>
                  <Link className="btn btn-primary btn-sm" to="/login">로그인</Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>
      <Outlet />
      <footer className="footer-light">
        <div className="container">
          <p><b className="footer-tag">로또 연구소 · 번호 기록·분석 도구</b></p>
          <p>회차별 번호 출현 횟수를 분석해서 내 가설이 맞았는지 기록하는 개인 분석 도구입니다.</p>
          <div className="legal-band">
            <Disclaimer compact />
          </div>
        </div>
      </footer>
    </>
  )
}
