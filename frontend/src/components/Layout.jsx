import { NavLink, Link, Outlet } from 'react-router-dom'

export default function Layout() {
  const cls = ({ isActive }) => (isActive ? 'active' : '')
  return (
    <>
      <header className="top-nav">
        <div className="container nav-inner">
          <Link className="wordmark" to="/draws">
            <img src="/logo.svg" alt="LottoLab" height="32" />
          </Link>
          <nav className="nav-links">
            <NavLink to="/draws" className={cls}>회차 관리</NavLink>
            <NavLink to="/analysis" className={cls}>가설 분석</NavLink>
          </nav>
          <Link className="btn btn-primary btn-sm" to="/analysis">분석 보기</Link>
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
