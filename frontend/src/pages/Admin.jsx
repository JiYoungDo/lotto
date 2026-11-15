import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.js'
import DrawAdmin from './admin/DrawAdmin.jsx'
import MemberAdmin from './admin/MemberAdmin.jsx'
import CommunityAdmin from './admin/CommunityAdmin.jsx'
import WinnerAdmin from './admin/WinnerAdmin.jsx'

const TABS = [
  ['draws', '회차 관리'],
  ['winners', '당첨자·채팅'],
  ['members', '회원 관리'],
  ['community', '커뮤니티 관리'],
]

// 관리자 전용 화면. 로그인하지 않았으면 로그인 화면으로, 관리자가 아니면 회차 번호 화면으로 보냄.
// (서버도 관리자 외의 요청을 거부합니다)
export default function Admin() {
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  if (!me) return <section className="section"><div className="container"><p className="empty">확인 중…</p></div></section>
  if (!me.loggedIn) return <Navigate to="/login" replace />
  if (!me.admin) return <Navigate to="/draws" replace />

  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'draws'

  return (
    <>
      <div className="admin-tabs">
        <div className="container admin-tabs-inner">
          <span className="admin-tabs-label">관리자</span>
          <div className="seg" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''}
                      onClick={() => setParams({ tab: k })}>{label}</button>
            ))}
          </div>
          <a className="admin-db-link" href="/h2-console" target="_blank" rel="noreferrer">DB 보기 ↗</a>
        </div>
      </div>
      {tab === 'draws' && <DrawAdmin username={me.username} />}
      {tab === 'winners' && <WinnerAdmin />}
      {tab === 'members' && <MemberAdmin me={me} />}
      {tab === 'community' && <CommunityAdmin />}
    </>
  )
}
