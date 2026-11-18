import { useEffect, useState } from 'react'
import {
  fetchMembers, fetchMemberStats, setMemberRole, setMemberSuspended, resetMemberPassword, deleteMember,
} from '../../api.js'
import { useAuth } from '../../auth.js'

const PERIODS = [['all', '전체'], ['today', '오늘'], ['week', '이번 주'], ['month', '이번 달']]
const FILTERS = [['all', '모든 회원'], ['USER', '일반 회원'], ['ADMIN', '관리자'], ['suspended', '정지']]

// 관리자 · 회원 관리: 가입 통계, 이번 주 가입자, 검색·필터, 권한 변경·정지·비밀번호 초기화·삭제
export default function MemberAdmin({ me }) {
  const { refresh } = useAuth()
  const [list, setList] = useState(null)
  const [stats, setStats] = useState(null)
  const [msg, setMsg] = useState(null)
  const [temp, setTemp] = useState(null) // { username, password }
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState('all')
  const [filter, setFilter] = useState('all')

  const load = () =>
    Promise.all([fetchMembers(), fetchMemberStats()])
      .then(([l, s]) => { setList(l); setStats(s) })
      .catch((e) => setMsg(e.message))
  useEffect(() => { load() }, [])

  const run = async (job) => {
    setMsg(null)
    setBusy(true)
    try {
      const r = await job()
      setMsg(r.message)
      await load()
      return r
    } catch (e) {
      setMsg(e.message)
      if (e.status === 401 || e.status === 403) await refresh()
      return null
    } finally {
      setBusy(false)
    }
  }

  const onRole = (m) => {
    const next = m.role === 'ADMIN' ? 'USER' : 'ADMIN'
    const label = next === 'ADMIN' ? '관리자' : '일반 회원'
    if (window.confirm(`${m.username}님을 ${label}(으)로 바꿀까요? 이 회원은 다시 로그인해야 합니다.`)) {
      run(() => setMemberRole(m.id, next))
    }
  }
  const onSuspend = (m) => {
    const text = m.suspended ? '정지를 해제할까요?' : '정지할까요? 바로 로그아웃되고 로그인·글쓰기를 할 수 없습니다.'
    if (window.confirm(`${m.username}님을 ${text}`)) run(() => setMemberSuspended(m.id, !m.suspended))
  }
  const onReset = async (m) => {
    if (!window.confirm(`${m.username}님의 비밀번호를 임시 비밀번호로 바꿀까요?`)) return
    const r = await run(() => resetMemberPassword(m.id))
    if (r) setTemp({ username: m.username, password: r.tempPassword })
  }
  const onDelete = (m) => {
    if (window.confirm(`${m.username}님을 삭제할까요? 회원 정보가 DB에서 지워지며 되돌릴 수 없습니다.`)) {
      run(() => deleteMember(m.id))
    }
  }

  // 기간 기준일 (서버가 알려준 이번 주 시작일 사용)
  const today = stats?.daily[stats.daily.length - 1]?.date
  const since = {
    all: '',
    today,
    week: stats?.weekStart,
    month: today ? today.slice(0, 8) + '01' : '',
  }[period] || ''

  const shown = (list || []).filter((m) =>
    (!q || [m.username, m.nickname].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))) &&
    (!since || m.createdDate >= since) &&
    (filter === 'all' || (filter === 'suspended' ? m.suspended : m.role === filter)))

  const weekJoined = (list || []).filter((m) => stats && m.createdDate >= stats.weekStart)
  const maxDaily = stats ? Math.max(1, ...stats.daily.map((d) => d.count)) : 1

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회원 현황</h2>
            <p>가입일은 한국 시간 기준이며, 이번 주는 월요일{stats ? `(${stats.weekStart})` : ''}부터입니다.</p>
          </div>

          <div className="stat-grid">
            <StatTile label="전체 회원" value={stats?.total} sub={stats ? `관리자 ${stats.admins} · 일반 ${stats.users}` : ''} />
            <StatTile label="오늘 가입" value={stats?.today} />
            <StatTile label="이번 주 가입" value={stats?.thisWeek} accent />
            <StatTile label="이번 달 가입" value={stats?.thisMonth} />
            <StatTile label="정지된 회원" value={stats?.suspended} />
          </div>

          <div className="grid-2" style={{ marginTop: 24 }}>
            <div className="feature-card">
              <div className="title-md">최근 14일 가입 수</div>
              {stats && (
                <div className="mini-bars" role="img" aria-label="최근 14일 일별 가입 수">
                  {stats.daily.map((d) => (
                    <div key={d.date} className="mini-bar-col" title={`${d.date}: ${d.count}명`}>
                      <span className="mini-bar-val">{d.count > 0 ? d.count : ''}</span>
                      <div className={'mini-bar' + (d.date >= stats.weekStart ? ' week' : '')}
                           style={{ height: `${Math.max(2, (d.count / maxDaily) * 100)}%` }} />
                      <span className="mini-bar-label">{d.date.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="caption" style={{ marginTop: 8 }}>진한 막대가 이번 주입니다. 막대에 마우스를 올리면 날짜와 가입 수가 보입니다.</p>
            </div>
            <div className="feature-card">
              <div className="title-md">이번 주 가입한 회원 {stats ? `${weekJoined.length}명` : ''}</div>
              {weekJoined.length === 0 ? (
                <p className="empty">이번 주에 가입한 회원이 없습니다.</p>
              ) : (
                <ul className="name-list">
                  {weekJoined.map((m) => (
                    <li key={m.id}><b>{m.nickname}</b> <span className="caption">{m.username}</span><span className="num muted">{m.createdAt.slice(5)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회원 관리</h2>
            <p>권한을 바꾸거나 정지·삭제하면 그 회원의 로그인이 바로 끊깁니다. 기본 관리자 계정과 본인 계정은 여기서 바꿀 수 없습니다.</p>
          </div>

          {temp && (
            <div className="temp-pw">
              <span><b>{temp.username}</b>님 임시 비밀번호</span>
              <code>{temp.password}</code>
              <button className="btn btn-secondary btn-sm" type="button"
                      onClick={() => navigator.clipboard?.writeText(temp.password).then(() => setMsg('복사했습니다.'))}>복사</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setTemp(null)}>닫기</button>
              <p className="caption">이 화면을 닫으면 다시 볼 수 없습니다. 회원에게 전달하고, 로그인 후 내 정보에서 바꾸도록 안내하세요.</p>
            </div>
          )}

          <div className="feature-card">
            <div className="toolbar">
              <input className="input" type="search" placeholder="아이디·닉네임 검색" value={q} onChange={(e) => setQ(e.target.value)}
                     style={{ maxWidth: 220 }} aria-label="아이디·닉네임 검색" />
              <div className="seg">
                {PERIODS.map(([k, label]) => (
                  <button key={k} type="button" className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{label}</button>
                ))}
              </div>
              <div className="seg">
                {FILTERS.map(([k, label]) => (
                  <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
                ))}
              </div>
              <span className="caption" style={{ marginLeft: 'auto' }}>{list ? `${shown.length} / ${list.length}명` : ''}</span>
            </div>

            <div className="table-wrap">
              {!list ? (
                <p className="empty">불러오는 중…</p>
              ) : shown.length === 0 ? (
                <p className="empty">조건에 맞는 회원이 없습니다.</p>
              ) : (
                <table className="list-table">
                  <thead>
                    <tr><th>아이디</th><th>닉네임</th><th>권한</th><th>상태</th><th>가입일</th><th>약관 동의</th><th>최근 로그인</th><th className="r">관리</th></tr>
                  </thead>
                  <tbody>
                    {shown.map((m) => {
                      const self = m.username === me.username
                      const locked = m.protected || self
                      return (
                        <tr key={m.id}>
                          <td className="title-md" style={{ fontSize: 15 }}>
                            {m.username}
                            {m.protected && <span className="caption"> · 기본 관리자</span>}
                            {self && !m.protected && <span className="caption"> · 나</span>}
                          </td>
                          <td>{m.nickname}</td>
                          <td><span className={'role-badge' + (m.role === 'ADMIN' ? ' admin' : '')}>{m.role === 'ADMIN' ? '관리자' : '일반 회원'}</span></td>
                          <td>{m.suspended ? <span className="role-badge danger">정지</span> : <span className="muted">정상</span>}</td>
                          <td className="num muted">{m.createdAt}</td>
                          <td><TermsCell m={m} /></td>
                          <td className="num muted">{m.lastLoginAt || '-'}</td>
                          <td>
                            {locked ? (
                              <div className="row-actions"><span className="caption">변경 불가</span></div>
                            ) : (
                              <div className="row-actions">
                                <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => onRole(m)}>
                                  {m.role === 'ADMIN' ? '일반으로' : '관리자로'}
                                </button>
                                <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => onSuspend(m)}>
                                  {m.suspended ? '정지 해제' : '정지'}
                                </button>
                                <button className="btn btn-secondary btn-sm" type="button" disabled={busy} onClick={() => onReset(m)}>비밀번호 초기화</button>
                                <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={() => onDelete(m)}>삭제</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          {msg && <p className="notice">{msg}</p>}
        </div>
      </section>
    </>
  )
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div className={'stat-tile' + (accent ? ' accent' : '')}>
      <div className="caption">{label}</div>
      <div className="stat-value">{value == null ? '-' : value.toLocaleString()}</div>
      {sub && <div className="caption">{sub}</div>}
    </div>
  )
}

// 약관 동의 칸: 동의 시각과 약관 버전. 기록이 없거나 이전 버전이면 따로 표시
function TermsCell({ m }) {
  if (!m.termsAgreedAt) return <span className="caption">기록 없음</span>
  const same = m.termsAgreedAt === m.privacyAgreedAt
  return (
    <span title={`이용약관 ${m.termsAgreedAt}\n개인정보 수집·이용 ${m.privacyAgreedAt || '-'}\n약관 버전 ${m.termsVersion}`}>
      <span className="num muted">{same ? m.termsAgreedAt : `${m.termsAgreedAt} / ${m.privacyAgreedAt || '-'}`}</span>
      <span className={'caption terms-ver' + (m.termsCurrent ? '' : ' old')}>{m.termsVersion}{m.termsCurrent ? '' : ' (이전 버전)'}</span>
    </span>
  )
}
