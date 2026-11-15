import { useEffect, useState } from 'react'
import { fetchAnalysis } from '../api.js'
import Balls from '../components/Balls.jsx'
import NormalChart from '../components/NormalChart.jsx'
import { CASES, CASE_GUIDE } from '../hypotheses.js'

const pct = (v, d = 2) => `${v.toFixed(d)}%`
const ALL_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1)
const RECENT = 50


// p-값을 사람이 읽기 쉬운 판정으로
function verdict(s) {
  if (s.total === 0) return { label: '-', cls: 'muted' }
  if (s.pValue < 0.01) return { label: '강한 근거', cls: 'up' }
  if (s.pValue < 0.05) return { label: '약한 근거', cls: 'up' }
  if (s.actualRate < s.expectedRate) return { label: '기대보다 낮음', cls: 'down' }
  return { label: '우연 범위', cls: 'muted' }
}

const fmtP = (p) => (p == null ? '-' : p < 0.0001 ? '< 0.0001' : p.toFixed(4))

export default function Analysis() {
  const [conf, setConf] = useState('60')
  const [min, setMin] = useState('30')
  const [showAll, setShowAll] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = (c, m) =>
    fetchAnalysis(c, m)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  useEffect(() => { load(60, 30) }, []) // 처음 한 번 실행

  const confNum = Number(conf)
  const minNum = Number(min)
  const invalid =
    conf === '' || !(confNum >= 1 && confNum <= 99) ? '신뢰구간은 1~99 사이로 입력하세요.'
      : min === '' || !Number.isInteger(minNum) || minNum < 1 ? '최소 회차는 1 이상의 정수로 입력하세요.'
        : null

  const onSubmit = (e) => {
    e.preventDefault()
    if (invalid) return
    setLoading(true)
    load(confNum, minNum)
  }

  const rows = data ? (showAll ? data.rows : data.rows.slice(-RECENT)).slice().reverse() : []
  const next = data?.next
  const best = data?.stats.length ? data.stats.reduce((a, b) => (b.pValue < a.pValue ? b : a)) : null

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
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 0 }}>{data ? `${data.conf}%` : '-'}</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">분석한 회차</div>
              <div className="card-stat">{data ? data.rows.length.toLocaleString() : '-'}</div>
              <div className="card-row"><span>케이스 1 적중</span><span className="num">{data && data.stats[0] ? `${data.stats[0].hits} / ${data.stats[0].total}` : '-'}</span></div>
              <div className="card-row"><span>가장 유의한 케이스</span><span className="num">{best ? `${best.caseNo} (p ${fmtP(best.pValue)})` : '-'}</span></div>
              <div className="card-row"><span>최소 회차</span><span className="num">{data ? data.min : '-'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">분석 설정</h2>
            <p>가운데 번호는 번호별 출현 횟수가 평균 ± z·표준편차 안에 드는 번호입니다. 신뢰구간이 넓을수록 가운데 번호가 많아집니다. 최소 회차만큼 데이터가 쌓인 뒤부터 판정합니다.</p>
          </div>
          <div className="feature-card">
            <form className="inline-form" onSubmit={onSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="conf">신뢰구간 (%)</label>
                <input className="input num" id="conf" type="number" min="1" max="99" step="any" value={conf} onChange={(e) => setConf(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="min">최소 회차</label>
                <input className="input num" id="min" type="number" min="1" step="1" value={min} onChange={(e) => setMin(e.target.value)} />
              </div>
              <label className="check">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> 전체 보기
              </label>
              <button className="btn btn-primary" type="submit" disabled={loading || !!invalid}>
                {loading ? '분석 중…' : '분석'}
              </button>
            </form>
            {invalid && <p className="notice">{invalid}</p>}
            <div className="setting-help">
              <div>
                <h3>신뢰구간 (%) — 가운데 번호 범위의 폭</h3>
                <p>회차마다 그 직전까지의 데이터로 번호 1~45의 출현 횟수를 세고, <b>평균 ± z × 표준편차</b> 안에 드는 번호를 가운데 번호로 정합니다. 평균은 회차 수 × 6 ÷ 45, z는 표준정규분포에서 가운데 그 비율만큼을 덮는 경계값입니다 (50% → 0.674, 60% → 0.842, 80% → 1.282, 95% → 1.960).</p>
                <p>값을 올리면 가운데 번호와 후보 조합이 늘어 적중이 쉬워지지만, 무작위 기대 비율도 함께 올라갑니다. 그래서 적중 횟수보다 기대 비율과의 차이와 p-값을 봐야 합니다. 통계에서 평균을 추정하는 신뢰구간과는 다르며, 정규분포의 비율을 범위 폭의 기준으로만 씁니다.</p>
                {next && (
                  <p className="setting-now">현재 적용: {data.conf}% → z = {next.z.toFixed(3)}, {next.round}회 기준 가운데 번호 {next.center.length}개</p>
                )}
              </div>
              <div>
                <h3>최소 회차 — 판정 전에 쌓을 데이터 수</h3>
                <p>처음 몇 회차는 데이터가 적어 출현 횟수가 거의 우연으로 정해지므로, 그 구간은 판정하지 않고 과거 데이터로만 씁니다. 30이면 처음 30개 회차는 데이터로만 쓰고 31번째 회차부터 판정합니다.</p>
                <p>값을 올리면 초반의 불안정한 판정이 빠지지만 분석 회차 수가 줄어듭니다. 회차 번호가 아니라 회차 개수이며, 1회부터 빠짐없이 있으면 둘이 같습니다.</p>
                {data && (
                  <p className="setting-now">현재 적용: 최소 {data.min}개 → 전체 {data.totalDraws.toLocaleString()}개 회차 중 {data.rows.length.toLocaleString()}개 판정</p>
                )}
              </div>
            </div>
          </div>
          {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">가설 적중 통계</h2>
            <p>실제 비율이 무작위 기대 비율보다 뚜렷이 높을 때만 가설에 근거가 생깁니다. p-값은 번호가 무작위로 나온다고 가정했을 때 이만큼 이상 적중할 확률이며, 0.05보다 작아야 우연으로 보기 어렵습니다. 케이스를 5개 동시에 보므로 0.01 기준이 더 안전합니다.</p>
          </div>
          <div className="feature-card">
            <div className="table-wrap">
              {!data ? (
                <p className="empty">{loading ? '분석 중입니다…' : '분석 결과가 없습니다.'}</p>
              ) : data.rows.length === 0 ? (
                <p className="empty">분석할 회차가 부족합니다. 회차 데이터를 {data.min + 1}개 이상 올려 주세요 (현재 {data.totalDraws}개).</p>
              ) : (
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>케이스</th><th className="r">적중</th><th className="r">실제 비율</th>
                      <th className="r">무작위 기대 비율</th><th className="r">차이</th><th className="r">기대 횟수</th>
                      <th className="r">평균 후보 조합 수</th><th className="r">p-값</th><th>판정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.map((s) => {
                      const diff = s.actualRate - s.expectedRate
                      const v = verdict(s)
                      return (
                        <tr key={s.caseNo}>
                          <td className="title-md" title={CASES[s.caseNo - 1]}>케이스 {s.caseNo}</td>
                          <td className="r num">{s.hits} / {s.total}</td>
                          <td className="r num">{pct(s.actualRate)}</td>
                          <td className="r num muted">{pct(s.expectedRate)}</td>
                          <td className={'r num ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'muted')}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}%p
                          </td>
                          <td className="r num muted">{s.expectedHits.toFixed(1)}</td>
                          <td className="r num muted">{Math.round(s.avgCandidates).toLocaleString()}</td>
                          <td className="r num">{fmtP(s.pValue)}</td>
                          <td className={v.cls} style={{ fontWeight: 600 }}>{v.label}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <p className="note">{CASES.map((c, i) => `케이스 ${i + 1}: ${c}`).join(' · ')}</p>
        </div>
      </section>

      {next && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2 className="display-sm">{next.round}회 기준</h2>
              <p>지금까지의 {data.totalDraws.toLocaleString()}개 회차로 계산한 다음 회차의 가운데 번호입니다. 흐린 공은 양끝(가운데가 아닌) 번호입니다. 참고용일 뿐 당첨 확률을 바꾸지 않습니다.</p>
            </div>
            <div className="grid-2">
              <div className="feature-card">
                <div className="title-md">가운데 번호 {next.center.length}개</div>
                <p className="caption" style={{ marginBottom: 16 }}>신뢰구간 {data.conf}% 기준</p>
                <Balls numbers={ALL_NUMBERS} dim={ALL_NUMBERS.filter((n) => !next.center.includes(n))} />
              </div>
              <div className="feature-card">
                <div className="title-md">직전 회차 ({next.round - 1}회)</div>
                <p className="caption" style={{ marginBottom: 16 }}>그중 가운데 번호 {next.prevInCenter}개</p>
                <Balls numbers={next.prevNumbers} dim={next.prevNumbers.filter((n) => !next.center.includes(n))} />
                <table className="list-table" style={{ marginTop: 24 }}>
                  <thead>
                    <tr><th>케이스</th><th className="r">후보 조합 수</th><th className="r">무작위 적중 확률</th></tr>
                  </thead>
                  <tbody>
                    {next.candidates.map((c, i) => (
                      <tr key={i}>
                        <td title={CASES[i]}>케이스 {i + 1}</td>
                        <td className="r num">{c.toLocaleString()}</td>
                        <td className="r num muted">{pct((c / 8145060) * 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {next && next.sd != null && (
        <section className="section band-soft">
          <div className="container">
            <div className="section-head">
              <h2 className="display-sm">번호별 표준정규분포</h2>
              <p>각 번호의 출현 횟수를 표준화한 z-점수를 표준정규분포 곡선 위에 놓았습니다. 파란 영역 안에 든 번호가 {next.round}회 기준 가운데 번호입니다. 공이나 막대에 마우스를 올리면 자세한 값이 나옵니다.</p>
            </div>
            <NormalChart counts={next.counts} mean={next.mean} sd={next.sd} z={next.z} draws={data.totalDraws} />
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">가설 안내</h2>
            <p>각 회차의 당첨 번호 6개가 아래 조건을 만족하면 그 케이스를 적중으로 봅니다. 가운데 번호는 그 회차 직전까지의 데이터로 정합니다. 미리 번호를 골라 맞혔다는 뜻이 아니라, 당첨 번호가 그 케이스의 후보 조합 안에 들어 있었다는 뜻입니다.</p>
          </div>
          <div className="case-grid">
            {CASE_GUIDE.map((g, i) => (
              <div className="feature-card case-card" key={i}>
                <div className="case-no">케이스 {i + 1}</div>
                <div className="title-md">{g.title}</div>
                <div className="pips" aria-hidden="true">
                  {g.pips.map((p, j) => <i key={j} className={'pip ' + p} />)}
                </div>
                <p className="case-desc">{g.desc}</p>
                <p className="case-formula">후보 조합 수 = {g.formula}</p>
                {next && (
                  <p className="case-now">{next.round}회 기준 후보 {next.candidates[i].toLocaleString()}개 ({pct((next.candidates[i] / 8145060) * 100)})</p>
                )}
              </div>
            ))}
          </div>
          <div className="case-legend" aria-hidden="true">
            <span><i className="pip c" />가운데 번호</span>
            <span><i className="pip e" />양끝 번호</span>
            <span><i className="pip c p" />직전 회차에도 나온 번호</span>
            <span><i className="pip c x" />직전 회차에 나오지 않은 번호</span>
          </div>
          <div className="setting-help">
            <div>
              <h3>케이스끼리의 관계</h3>
              <p>케이스 2와 3은 케이스 1에 포함됩니다. 2나 3이 적중이면 1도 항상 적중입니다. 2와 3은 동시에 적중할 수 없습니다.</p>
              <p>케이스 1, 4, 5는 가운데 번호 개수가 6, 4, 5개로 달라 서로 겹치지 않습니다.</p>
            </div>
            <div>
              <h3>한 회차에 나올 수 있는 판정</h3>
              <p>적중 없음(가운데 번호 3개 이하) · 1만(6개 모두 가운데, 직전 회차와 2개 이상 겹침) · 1+2 · 1+3 · 4만 · 5만, 이렇게 여섯 가지뿐입니다.</p>
              <p>k = 가운데 번호 수, m = 직전 회차 번호 중 가운데 번호 수, C(n, r) = n개 중 r개를 고르는 조합 수입니다. 후보가 많을수록 우연히도 자주 적중합니다.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차별 판정</h2>
            <p>
              흐린 공은 그 회차 직전 기준 가운데 번호가 아닌 번호입니다. 케이스 칸 아래 숫자는 그 회차에서 그 케이스를 만족하는 전체 조합 수(후보 가짓수, 전체 8,145,060개 중)입니다.
              {data && data.rows.length > 0 && ` ${showAll ? `전체 ${data.rows.length.toLocaleString()}회` : `최근 ${Math.min(RECENT, data.rows.length)}회`}를 최신순으로 보여줍니다.`}
            </p>
          </div>
          <div className="feature-card">
            <div className="table-wrap">
              {rows.length === 0 ? (
                <p className="empty">표시할 회차가 없습니다.</p>
              ) : (
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>회차</th><th>번호</th><th className="r">가운데 수</th>
                      {[1, 2, 3, 4, 5].map((c) => <th key={c} title={CASES[c - 1]}>케이스 {c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.round}>
                        <td className="num">{a.round}</td>
                        <td><Balls numbers={a.numbers} dim={a.numbers.filter((n) => !a.center.includes(n))} /></td>
                        <td className="r num muted">{a.numbers.filter((n) => a.center.includes(n)).length} / {a.center.length}</td>
                        {a.hits.map((h, i) => (
                          <td key={i} className={'case-cell ' + (h ? 'hit' : 'miss')}
                              title={a.candidates ? `케이스 ${i + 1} 후보 ${a.candidates[i].toLocaleString()}개 조합` : undefined}>
                            <span>{h ? '적중' : '-'}</span>
                            {a.candidates && <span className="case-count">{a.candidates[i].toLocaleString()}개</span>}
                          </td>
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
