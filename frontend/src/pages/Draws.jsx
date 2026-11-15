import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDraws } from '../api.js'
import PoolStatus from '../components/PoolStatus.jsx'
import { useDrawEvents } from '../drawEvents.js'
import Balls from '../components/Balls.jsx'

const PAGE = 50

// 누구나 볼 수 있는 회차별 당첨 번호 목록 (등록은 관리자 화면에서)
export default function Draws() {
  const [limit, setLimit] = useState(PAGE)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // 관리자가 회차를 등록·수정하면 목록을 바로 다시 불러옴
  useDrawEvents(() => setTick((n) => n + 1))

  useEffect(() => {
    fetchDraws(limit)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [limit, tick])

  const more = () => { setLoading(true); setLimit(limit + PAGE) }
  const latest = data?.draws[0]

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">회차 데이터</span>
            <h1 className="display-mega">회차별<br />당첨 번호</h1>
            <p className="lead">지금까지의 모든 회차 당첨 번호를 볼 수 있습니다. 쌓인 데이터로 가설이 맞았는지 바로 분석합니다.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/analysis">가설 분석 보기</Link>
              <a className="btn btn-outline-dark btn-lg" href="#list">번호 보기</a>
            </div>
          </div>
          <div className="hero-cards">
            <div className="card-dark card-back">
              <div className="card-label">최신 회차</div>
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 0 }}>{latest ? `${latest.round}회` : '-'}</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">저장된 회차</div>
              <div className="card-stat">{data ? data.total.toLocaleString() : '-'}</div>
              <div className="card-label" style={{ marginBottom: 8 }}>최신 당첨 번호</div>
              <div>{latest ? <Balls numbers={latest.numbers} /> : <span className="num">-</span>}</div>
            </div>
          </div>
        </div>
      </section>

      <PoolStatus />

      <section className="section band-soft" id="list">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차별 번호</h2>
            <p>{data ? `총 ${data.total.toLocaleString()}회 중 최근 ${data.draws.length.toLocaleString()}회를 최신순으로 보여줍니다.` : '불러오는 중...'}</p>
          </div>
          {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
          {data && (
            <div className="feature-card">
              <div className="table-wrap">
                {data.draws.length === 0 ? (
                  <p className="empty">아직 등록된 회차가 없습니다.</p>
                ) : (
                  <table className="list-table">
                    <thead><tr><th>회차</th><th>당첨 번호</th></tr></thead>
                    <tbody>
                      {data.draws.map((d) => (
                        <tr key={d.round}>
                          <td className="num">{d.round}</td>
                          <td><Balls numbers={d.numbers} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {data.draws.length < data.total && (
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <button className="btn btn-secondary" type="button" onClick={more} disabled={loading}>
                    {loading ? '불러오는 중…' : `${PAGE}회 더 보기`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
