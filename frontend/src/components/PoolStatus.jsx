import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPool } from '../api.js'
import { useAuth } from '../auth.js'
import { CASE_GUIDE } from '../hypotheses.js'
import { useDrawEvents } from '../drawEvents.js'

const REFRESH_MS = 30_000

// 다음 회차 조합 현황: 가설별 전체 조합 중 회원들이 저장해 소진된 수와 남은 수
export default function PoolStatus() {
  const { me } = useAuth()
  const [pool, setPool] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  // 관리자가 회차를 등록하면 다음 회차 기준으로 바로 다시 계산
  useDrawEvents(() => setTick((n) => n + 1))

  useEffect(() => {
    let alive = true
    const load = () => fetchPool(60)
      .then((d) => { if (alive) { setPool(d); setError(null) } })
      .catch((e) => alive && setError(e.message))
    load()
    const t = setInterval(load, REFRESH_MS) // 다른 회원이 저장하면 30초 안에 반영
    return () => { alive = false; clearInterval(t) }
  }, [tick])

  if (error) return null
  const all = pool?.cases[0]

  return (
    <section className="section" id="pool">
      <div className="container">
        <div className="section-head">
          <h2 className="display-sm">{pool ? `${pool.round}회` : '이번 회차'} 남은 조합</h2>
          <p>
            각 가설이 만들 수 있는 전체 조합 중 회원들이 마이페이지에 저장한 조합은 소진됩니다.
            한 조합은 한 명만 가질 수 있어서, 누군가 저장한 번호는 다른 회원이 만들거나 저장할 수 없습니다.
          </p>
        </div>

        <div className="pool-hero">
          <div>
            <div className="caption">전체 조합 (1~45 중 6개)</div>
            <div className="pool-big num">{all ? all.remaining.toLocaleString() : '-'}<span> 남음</span></div>
            <div className="caption">{all ? `${all.total.toLocaleString()}개 중 ${all.used.toLocaleString()}개 소진` : ''}</div>
          </div>
          <div className="pool-side">
            <div><span className="caption">저장한 회원</span><b className="num">{pool ? pool.savers.toLocaleString() : '-'}명</b></div>
            <div><span className="caption">저장된 번호</span><b className="num">{pool ? pool.savedTickets.toLocaleString() : '-'}줄</b></div>
            {me?.loggedIn
              ? <Link className="btn btn-primary btn-sm" to="/mypage#make">내 번호 만들기</Link>
              : <Link className="btn btn-primary btn-sm" to="/login">로그인하고 번호 만들기</Link>}
          </div>
        </div>

        <div className="pool-grid">
          {(pool ? pool.cases.slice(1) : CASE_GUIDE.map(() => null)).map((c, i) => (
            <div key={i} className="pool-card">
              <div className="case-no">가설 {i + 1}</div>
              <div className="pool-title">{CASE_GUIDE[i].title}</div>
              <div className="pool-num num">{c ? c.remaining.toLocaleString() : '-'}</div>
              <div className="caption">남은 조합</div>
              <div className="pool-meta">
                <span>전체 <b className="num">{c ? c.total.toLocaleString() : '-'}</b></span>
                <span>소진 <b className="num">{c ? c.used.toLocaleString() : '-'}</b></span>
              </div>
            </div>
          ))}
        </div>
        <p className="note">
          가설별 조합 수는 지금까지의 당첨 번호로 계산한 가운데 번호(신뢰구간 60%{pool ? `, ${pool.centerSize}개` : ''})와 직전 회차 번호 기준입니다.
          한 번호가 여러 가설 조건을 동시에 만족하면 각 가설에서 모두 소진으로 셉니다. 30초마다 새로 고칩니다.
        </p>
      </div>
    </section>
  )
}
