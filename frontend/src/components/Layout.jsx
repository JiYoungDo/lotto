import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.js'

export default function Layout() {
  const cls = ({ isActive }) => (isActive ? 'active' : '')
  const { me, signOut } = useAuth()
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
            <img src="/logo.svg" alt="LottoLab" height="32" />
          </Link>
          <nav className="nav-links">
            <NavLink to="/draws" className={cls}>회차 번호</NavLink>
            <NavLink to="/analysis" className={cls}>가설 분석</NavLink>
            <NavLink to="/community" className={cls}>커뮤니티</NavLink>
            {admin && <NavLink to="/admin" className={cls}>관리자</NavLink>}
          </nav>
          {/* 로그인 상태 확인 전(me === null)에는 버튼을 잠시 숨김 */}
          {me && (
            <div className="nav-auth">
              {me.loggedIn ? (
                <>
                  <Link className="nav-user" to="/account" title="내 정보">{me.username}{admin && <span className="badge">관리자</span>}</Link>
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
          <p>회차별 번호 출현 횟수를 분석해서 내 가설이 맞았는지 기록하는 개인 분석 도구입니다.</p>
          <div className="legal-band">
            당첨을 보장하거나 확률을 높이지 않으며 오락·학습 용도입니다. 미성년자는 이용할 수 없고, 도박 문제 상담은 1336입니다.
          </div>
        </div>
      </footer>
    </>
  )
}
