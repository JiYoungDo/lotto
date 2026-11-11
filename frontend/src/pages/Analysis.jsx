import { useEffect, useState } from 'react'
import { fetchAnalysis } from '../api.js'
import Balls from '../components/Balls.jsx'

const pct = (v, d = 2) => `${v.toFixed(d)}%`

export default function Analysis() {
  const [conf, setConf] = useState(60)
  const [min, setMin] = useState(30)
  const [showAll, setShowAll] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    setError(null)
    fetchAnalysis(conf, min).then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, []) // 처음 한 번 실행

  const rows = data ? (showAll ? data.rows : data.rows.slice(-50)).slice().reverse() : []

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">가설 분석</span>
            <h1 className="display-mega">가설은<br />얼마나 맞았을까</h1>
            <p className="lead">각 회차를 그 직전까지의 데이터만으로 판정하고, 무작위일 때의 기대 비율과 비교합니다.</p>
          </div>
          <div className="hero-cards">
            <div className="card-dark card-back">
              <div className="card-label">신뢰구간</div>
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 0 }}>{conf}%</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">분석한 회차</div>
              <div className="card-stat">{data ? data.rows.length.toLocaleString() : '-'}</div>
              <div className="card-row"><span>케이스 1 적중</span><span className="num">{data && data.stats[0] ? `${data.stats[0].hits} / ${data.stats[0].total}` : '-'}</span></div>
              <div className="card-row"><span>최소 회차</span><span className="num">{min}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">분석 설정</h2>
            <p>가운데 번호는 번호별 출현 횟수가 평균 ± z·표준편차 안에 드는 번호입니다. 신뢰구간이 넓을수록 가운데 번호가 많아집니다.</p>
          </div>
          <div className="feature-card">
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); load() }}>
              <div className="field">
                <label className="field-label" htmlFor="conf">신뢰구간 (%)</label>
                <input className="input num" id="conf" type="number" min="1" max="99" value={conf} onChange={(e) => setConf(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="min">최소 회차</label>
                <input className="input num" id="min" type="number" min="1" value={min} onChange={(e) => setMin(e.target.value)} />
              </div>
              <label className="check">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> 전체 보기
              </label>
              <button className="btn btn-primary" type="submit">분석</button>
            </form>
          </div>
          {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">가설 적중 통계</h2>
            <p>실제 비율이 무작위 기대 비율보다 뚜렷이 높을 때만 가설에 근거가 생깁니다. 후보가 많은 케이스는 우연히도 자주 적중합니다.</p>
          </div>
          <div className="feature-card">
            <div className="table-wrap">
              {!data || data.stats.length === 0 ? (
                <p className="empty">분석할 회차가 부족합니다. 회차 데이터를 먼저 올려 주세요.</p>
              ) : (
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>케이스</th><th className="r">적중</th><th className="r">실제 비율</th>
                      <th className="r">무작위 기대 비율</th><th className="r">기대 횟수</th><th className="r">평균 후보 조합 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.map((s) => (
                      <tr key={s.caseNo}>
                        <td className="title-md">케이스 {s.caseNo}</td>
                        <td className="r num">{s.hits} / {s.total}</td>
                        <td className="r num">{pct(s.actualRate)}</td>
                        <td className="r num muted">{pct(s.expectedRate)}</td>
                        <td className="r num muted">{s.expectedHits.toFixed(1)}</td>
                        <td className="r num muted">{Math.round(s.avgCandidates).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <p className="note">케이스 1: 6개 모두 가운데 번호 · 케이스 2: 케이스 1 + 직전 회차 번호 0개 · 케이스 3: 케이스 1 + 직전 회차 번호 1개 · 케이스 4: 가운데 4 + 양끝 2 · 케이스 5: 가운데 5 + 양끝 1</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차별 판정</h2>
            <p>흐린 공은 그 회차 직전 기준 가운데 번호가 아닌 번호입니다.</p>
          </div>
          <div className="feature-card">
            <div className="table-wrap">
              {rows.length === 0 ? (
                <p className="empty">표시할 회차가 없습니다.</p>
              ) : (
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>회차</th><th>번호</th>
                      {[1, 2, 3, 4, 5].map((c) => <th key={c}>케이스 {c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.round}>
                        <td className="num">{a.round}</td>
                        <td><Balls numbers={a.numbers} dim={a.numbers.filter((n) => !a.center.includes(n))} /></td>
                        {a.hits.map((h, i) => (
                          <td key={i} className={h ? 'hit' : 'miss'}>{h ? '적중' : '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
