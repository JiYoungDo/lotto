import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.js'
import { useNotify } from '../notify.js'
import Disclaimer from './Disclaimer.jsx'
import AdSlot from './AdSlot.jsx'
import TermsGate from './TermsGate.jsx'

// 푸터 위 광고를 보여 줄 화면 (게임이 있는 회차 번호, 로그인·가입·마이페이지·관리자 같은 입력 화면은 제외)
const BOTTOM_AD_PATHS = ['/analysis', '/community']
// 새 약관 동의 전에도 열 수 있는 화면 (약관 읽기, 탈퇴)
const OPEN_BEFORE_AGREE = ['/terms', '/privacy', '/account']   // 가이드(/guide...)는 아래에서 따로 허용

export default function Layout() {
  const cls = ({ isActive }) => (isActive ? 'active' : '')
  const { me, signOut } = useAuth()
  const { unread } = useNotify()
  const admin = me?.admin
  const navigate = useNavigate()
  const { pathname } = useLocation()
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
            <NavLink to="/guide" className={cls}>가이드</NavLink>
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
      {me?.termsRequired && !OPEN_BEFORE_AGREE.includes(pathname) && !pathname.startsWith('/guide') && !pathname.startsWith('/draw/') ? <TermsGate /> : <Outlet />}
      {BOTTOM_AD_PATHS.includes(pathname) && <AdSlot key={pathname} type="bottom" />}
      <footer className="footer-dark">
        <div className="container">
          {/* 어두운 푸터에는 글자가 흰색인 로고 */}
          <Link className="footer-brand" to="/draws">
            <img src="/logo-dark.svg" alt="로또 연구소" height="32" />
            <span className="footer-tag">번호 기록·분석 도구</span>
          </Link>
          <p>회차별 번호 출현 횟수를 분석해서 내 가설이 맞았는지 기록하는 개인 분석 도구입니다.</p>
          <nav className="footer-links" aria-label="약관">
            <Link to="/guide">가이드</Link>
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy"><b>개인정보 처리방침</b></Link>
          </nav>
          <div className="legal-band">
            <Disclaimer compact />
          </div>
        </div>
      </footer>
    </>
  )
}
