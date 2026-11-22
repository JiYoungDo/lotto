import { Fragment, useEffect, useState } from 'react'
import { fetchAnalysis } from '../api.js'
import Balls from '../components/Balls.jsx'
import NormalChart from '../components/NormalChart.jsx'
import { CASES, CASE_GUIDE } from '../hypotheses.js'
import AdSlot from '../components/AdSlot.jsx'

const pct = (v, d = 2) => `${v.toFixed(d)}%`
const ALL_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1)
const RECENT = 50
const RANKS = ['1등', '2등', '3등', '4등', '5등']
const fmtRate = (v) => (v === 0 ? '0%' : v < 0.01 ? '< 0.01%' : pct(v))

// 후보에서 빼는 조합 안내 (key는 서버 exclusions[].key 와 같음)
const EXCLUDE_GUIDE = {
  repeat: {
    title: '이미 나온 당첨 조합',
    example: '예: 지난 회차 번호 6개 그대로',
    desc: '시험에 작년 기출문제가 토씨 하나 안 바뀌고 다시 나올 거라 기대하진 않죠. 실제로 지금까지 6개가 통째로 똑같이 나온 회차는 없었습니다. 그래서 이미 한 번 쓰인 답안지는 후보에서 내려놓습니다.',
    count: (r) => `당첨 조합 ${r.combos.toLocaleString()}개`,
    expectLabel: '같은 조합이 다시 나온 횟수',
  },
  run5: {
    title: '5개 이상 연속된 번호',
    example: '예: 7 8 9 10 11 + 30, 1~6',
    desc: '출석번호 순서대로 다섯 명이 나란히 뽑히는 장면은 상상만 해도 어색하죠. 이런 줄 세우기 조합은 전체의 0.02%뿐이라 빼도 후보가 거의 줄지 않고, 실제로도 한 번도 나오지 않았습니다.',
    count: (r) => `${r.combos.toLocaleString()}개 (6연속 40개 포함)`,
    expectLabel: '실제 당첨',
  },
  arithmetic: {
    title: '간격이 일정한 등차수열',
    example: '예: 3 10 17 24 31 38',
    desc: '달력에서 같은 요일만 골라 동그라미 친 것처럼, 번호 사이 간격이 전부 똑같은 조합입니다. 너무 반듯한 모양이라 손으로 고르기는 쉬워도 추첨기에서 나온 적은 없습니다.',
    count: (r) => `${r.combos.toLocaleString()}개`,
    expectLabel: '실제 당첨',
  },
}


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
  const [visible, setVisible] = useState(RECENT) // 회차별 판정에 보여줄 회차 수 (최신부터)
  const [open, setOpen] = useState(null) // 등수별 조합 수를 펼쳐 본 회차
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = (c, m) =>
    fetchAnalysis(c, m)
      .then((d) => { setData(d); setError(null); setVisible(RECENT) })
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

  const rows = data ? data.rows.slice(-visible).reverse() : []
  const hidden = data ? Math.max(0, data.rows.length - visible) : 0 // 아직 안 보인 이전 회차 수
  const next = data?.next
  const best = data?.stats.length ? data.stats.reduce((a, b) => (b.pValue < a.pValue ? b : a)) : null
  const totalHits = data ? data.stats.reduce((sum, s) => sum + s.hits, 0) : 0 // 가설끼리 겹치지 않아 그대로 더함

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
              <div className="card-row"><span>가설 1~9 중 하나라도 적중</span><span className="num">{data && data.stats[0] ? `${totalHits} / ${data.stats[0].total}` : '-'}</span></div>
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
            <p>지금까지 너무 자주도, 너무 드물게도 나오지 않은 ‘평범한’ 번호들을 가운데 번호라고 부릅니다. 두 가지 값만 정하면 됩니다. 평범함의 폭을 얼마나 넓게 볼지(신뢰구간), 그리고 판단하기 전에 데이터를 얼마나 모을지(최소 회차)입니다.</p>
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
              <button className="btn btn-primary" type="submit" disabled={loading || !!invalid}>
                {loading ? '분석 중…' : '분석'}
              </button>
            </form>
            {invalid && <p className="notice">{invalid}</p>}
            <div className="setting-help">
              <div>
                <h3>신뢰구간 (%) — 가운데 번호 범위의 폭</h3>
                <p>반 친구들 성적을 떠올려 보세요. 평균 근처에 가장 많은 친구가 모여 있죠. 60%로 정하면 ‘평균 근처에 모인 60%’ 안에 드는 번호를 가운데 번호로 삼습니다. 계산으로는 출현 횟수가 <b>평균 ± z × 표준편차</b> 안에 드는 번호입니다. 출현 횟수는 당첨 번호 6개와 보너스 번호 1개를 모두 누적해 세므로 평균은 회차 수 × 7 ÷ 45입니다 (50% → z 0.674, 60% → 0.842, 80% → 1.282, 95% → 1.960).</p>
                <p>그물을 넓게 던지면 고기가 더 잘 걸리지만, 아무렇게나 던져도 잘 걸리는 건 마찬가지입니다. 값을 올리면 적중이 늘어나는 대신 무작위 기대 비율도 같이 올라가니, 적중 횟수보다 기대 비율과의 차이와 p-값을 봐 주세요. 교과서의 ‘평균을 추정하는 신뢰구간’과는 다르고, 정규분포의 비율을 범위 폭의 기준으로만 빌려 씁니다.</p>
                {next && (
                  <p className="setting-now">현재 적용: {data.conf}% → z = {next.z.toFixed(3)}, {next.round}회 기준 가운데 번호 {next.center.length}개, 많은 양끝 번호 {next.high.length}개</p>
                )}
              </div>
              <div>
                <h3>최소 회차 — 판정 전에 쌓을 데이터 수</h3>
                <p>동전을 세 번 던져 세 번 다 앞면이 나왔다고 ‘앞면이 잘 나오는 동전’이라 할 수는 없죠. 처음 몇 회차는 데이터가 너무 적어 우연에 크게 흔들리므로, 판정하지 않고 밑거름으로만 씁니다. 30이면 처음 30개 회차를 모은 뒤 31번째 회차부터 판정합니다.</p>
                <p>값을 올리면 판정은 더 차분해지지만, 판정할 회차는 그만큼 줄어듭니다. 회차 번호가 아니라 회차 개수이며, 1회부터 빠짐없이 있으면 둘이 같습니다.</p>
                {data && (
                  <p className="setting-now">현재 적용: 최소 {data.min}개 → 전체 {data.totalDraws.toLocaleString()}개 회차 중 {data.rows.length.toLocaleString()}개 판정</p>
                )}
              </div>
            </div>
          </div>
          {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
          {data?.missingBonus > 0 && (
            <p className="notice">보너스 번호가 없는 회차가 {data.missingBonus.toLocaleString()}개 있습니다. 이 회차들은 출현 횟수에 당첨 번호 6개만 들어가고, 2등 조합은 3등으로 셉니다. 관리자 화면에서 I열(보너스)이 있는 엑셀을 다시 올려 주세요.</p>
          )}
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

          {data?.repeat && data.repeat.pairs > 0 && (
            <div className="exclude-block">
              <div className="section-head">
                <h3 className="display-xs">직전 회차 번호가 다음 회차에 다시 나온 횟수</h3>
                <p>바로 앞 회차 당첨 번호 6개 중 몇 개가 다음 회차 당첨 번호 6개에 다시 들어 있었는지 셉니다 (보너스 번호 제외, 신뢰구간·최소 회차와 상관없이 전체 회차 기준). 가설 2·3·5·6·8·9가 기대는 ‘직전 회차 번호가 1~2개 다시 나온다’는 생각이 실제로 얼마나 맞는지 확인하는 표입니다.</p>
              </div>
              <div className="feature-card">
                <p className="title-md" style={{ marginTop: 0 }}>
                  {data.repeat.pairs.toLocaleString()}번 중 <b>{data.repeat.atLeastOne.toLocaleString()}번</b>({pct((data.repeat.atLeastOne / data.repeat.pairs) * 100)})은 직전 회차 번호가 1개 이상 다시 나왔습니다
                </p>
                <p className="case-now">무작위 기대 {data.repeat.expectedAtLeastOne.toFixed(1)}번 ({pct((data.repeat.expectedAtLeastOne / data.repeat.pairs) * 100)}) · 다시 나온 번호 합계 {data.repeat.repeatedNumbers.toLocaleString()}개 (회차당 평균 {(data.repeat.repeatedNumbers / data.repeat.pairs).toFixed(2)}개, 기대 0.80개)</p>
                <div className="table-wrap">
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>다시 나온 개수</th><th className="r">실제 회차 수</th><th className="r">실제 비율</th>
                        <th className="r">무작위 기대 회차 수</th><th className="r">기대 비율</th><th className="r">차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.repeat.actual.map((a, k) => {
                        const e = data.repeat.expected[k]
                        const diff = a - e
                        return (
                          <tr key={k}>
                            <td className="title-md">{k}개</td>
                            <td className="r num">{a.toLocaleString()}</td>
                            <td className="r num">{pct((a / data.repeat.pairs) * 100)}</td>
                            <td className="r num muted">{e.toFixed(1)}</td>
                            <td className="r num muted">{fmtRate((e / data.repeat.pairs) * 100)}</td>
                            <td className={'r num ' + (diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'muted')}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {data && data.rows.length > 0 && data.stats[0]?.prizeCombos && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2 className="display-sm">가설별 당첨 조합 집계</h2>
              <p>매 회차 그 케이스의 후보 조합 중 실제 당첨 번호와 맞춰 1등~5등이 되는 조합이 몇 개였는지 판정한 회차 전체에 걸쳐 더했습니다. 5등 이상 확률은 매 회차 그 케이스 후보에서 아무 조합이나 한 장 샀을 때 5등 이상이 나올 확률의 평균입니다. 후보가 0개인 회차는 살 수 없으니 빼고 계산합니다. 아무 조합이나 샀을 때의 확률은 {pct(data.stats[0].randomWinRate, 3)}(약 1/{Math.round(100 / data.stats[0].randomWinRate)})입니다.</p>
            </div>
            <div className="feature-card">
              <div className="table-wrap">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>케이스</th>
                      {RANKS.map((r) => <th key={r} className="r">{r} 조합</th>)}
                      <th className="r">5등 이상 확률</th><th className="r">무작위 확률</th><th className="r">배율</th><th className="r">살 수 있던 회차</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.map((s) => {
                      const ratio = s.randomWinRate > 0 ? s.winRate / s.randomWinRate : 0
                      return (
                        <tr key={s.caseNo}>
                          <td className="title-md" title={CASES[s.caseNo - 1]}>케이스 {s.caseNo}</td>
                          {s.prizeCombos.map((c, r) => (
                            <td key={r} className="r num" title={`회차 평균 확률 ${fmtRate(s.rankRates[r])}`}>{c.toLocaleString()}</td>
                          ))}
                          <td className="r num" style={{ fontWeight: 600 }}>{s.playable ? pct(s.winRate, 3) : '-'}</td>
                          <td className="r num muted">{pct(s.randomWinRate, 3)}</td>
                          <td className={'r num ' + (!s.playable ? 'muted' : ratio > 1 ? 'up' : ratio < 1 ? 'down' : 'muted')}>
                            {s.playable ? `${ratio.toFixed(2)}배` : '-'}
                          </td>
                          <td className="r num muted">{s.playable.toLocaleString()} / {s.total.toLocaleString()}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="note">1등 조합 수는 그 케이스가 적중한 회차 수와 같습니다 (당첨 번호 자체가 후보에 들어 있었다는 뜻). 배율이 1보다 크면 그 케이스 후보가 무작위보다 5등 이상을 더 자주 품었다는 뜻이지만, 우연의 폭도 크니 참고로만 봐 주세요. 숫자 칸에 마우스를 올리면 등수별 회차 평균 확률이 나옵니다.</p>
          </div>
        </section>
      )}

      <AdSlot type="inline" />

      {next && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <h2 className="display-sm">{next.round}회 기준</h2>
              <p>지금까지의 {data.totalDraws.toLocaleString()}개 회차로 계산한 다음 회차의 번호 묶음입니다. 가설은 직전 회차 번호, 직전 회차를 뺀 가운데 번호, 직전 회차를 뺀 많은 양끝 번호만 씁니다. 참고용일 뿐 당첨 확률을 바꾸지 않습니다.</p>
            </div>
            <div className="grid-2">
              <div className="feature-card">
                <div className="title-md">가운데 번호 {next.center.length}개</div>
                <p className="caption" style={{ marginBottom: 16 }}>신뢰구간 {data.conf}% 기준 · 직전 회차 번호를 빼면 {next.freshCenter}개 (흐린 공은 가운데가 아닌 번호)</p>
                <Balls numbers={ALL_NUMBERS} dim={ALL_NUMBERS.filter((n) => !next.center.includes(n))} />
                <div className="title-md" style={{ marginTop: 24 }}>많은 양끝 번호 {next.high.length}개</div>
                <p className="caption" style={{ marginBottom: 16 }}>가운데 범위보다 많이 나온 번호 · 직전 회차 번호를 빼면 {next.freshHigh}개</p>
                {next.high.length > 0 ? <Balls numbers={next.high} dim={next.high.filter((n) => next.prevNumbers.includes(n))} /> : <p className="caption">없음</p>}
              </div>
              <div className="feature-card">
                <div className="title-md">직전 회차 ({next.round - 1}회)</div>
                <p className="caption" style={{ marginBottom: 16 }}>
                  가운데 {next.prevNumbers.filter((n) => next.center.includes(n)).length}개 · 많은 양끝 {next.prevNumbers.filter((n) => next.high.includes(n)).length}개 · 적은 양끝 {next.prevNumbers.filter((n) => !next.center.includes(n) && !next.high.includes(n)).length}개. 가설에서는 묶음과 상관없이 ‘직전 회차 번호’로 씁니다.
                </p>
                <Balls numbers={next.prevNumbers} />
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
              <p>학교 성적표를 보면 평균 근처 점수를 받은 학생이 가장 많고, 아주 높거나 아주 낮은 점수로 갈수록 드물어집니다. 키도, 몸무게도 마찬가지예요. 세상의 많은 것이 이렇게 가운데가 볼록한 종 모양으로 모인다는 걸 발견하고, 그 모양을 누구나 같은 눈금으로 비교할 수 있게 다듬은 것이 표준정규분포입니다.</p>
              <p>로또 번호도 회차가 쌓이면 (당첨 번호 6개와 보너스 번호를 모두 센 출현 횟수가) 대부분 비슷하고, 유난히 많이 또는 적게 나온 번호는 소수입니다. 각 번호가 평균에서 얼마나 떨어져 있는지(z-점수)를 이 종 위에 올려 보았습니다. 파란 영역 안, 즉 ‘반에서 평균 근처에 모인 학생들’에 해당하는 번호가 {next.round}회 기준 가운데 번호입니다. 공이나 막대에 마우스를 올리면 자세한 값이 나옵니다.</p>
            </div>
            <NormalChart counts={next.counts} mean={next.mean} sd={next.sd} z={next.z} draws={data.totalDraws} />
          </div>
        </section>
      )}

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">가설 안내</h2>
            <p>‘당첨 번호는 평범한 번호를 중심으로, 지난주 번호 한두 개와 자주 나오던 인기 번호 한두 개가 섞여 나오지 않을까?’ 하는 질문에서 출발한 아홉 가지 가설입니다. 각 회차의 당첨 번호 6개가 아래 조건에 꼭 맞으면 그 케이스를 적중으로 봅니다. 가운데·양끝 번호는 그 회차 직전까지의 데이터로만 정하니, 미래를 미리 엿보지는 않습니다. 적중은 미리 번호를 골라 맞혔다는 뜻이 아니라, 당첨 번호가 그 케이스가 그린 울타리 안에 들어 있었다는 뜻입니다.</p>
          </div>
          <div className="setting-help" style={{ marginTop: 0, marginBottom: 32 }}>
            <div>
              <h3>번호를 네 묶음으로 나눕니다</h3>
              <p><b>직전 회차 번호</b> — 바로 앞 회차 당첨 번호 6개입니다. 가운데 번호든 양끝 번호든 상관없이 이 묶음으로 셉니다.</p>
              <p><b>가운데 번호</b> — 직전 회차 번호를 뺀 나머지 중 출현 횟수가 평균 근처(평균 ± z × 표준편차)인 번호입니다. 개수를 a라고 씁니다.</p>
              <p><b>많은 양끝 번호</b> — 직전 회차 번호를 뺀 나머지 중 출현 횟수가 가운데 범위보다 많은, 유난히 자주 나온 번호입니다. 개수를 b라고 씁니다.</p>
              <p><b>적은 양끝 번호</b> — 직전 회차 번호를 뺀 나머지 중 가운데 범위보다 덜 나온 번호입니다. 어느 가설에도 쓰지 않습니다.</p>
            </div>
            <div>
              <h3>아홉 가설 한눈에 보기</h3>
              <div className="table-wrap">
                <table className="list-table case-matrix">
                  <thead>
                    <tr><th>많은 양끝 \ 직전 회차</th><th className="r">0개</th><th className="r">1개</th><th className="r">2개</th></tr>
                  </thead>
                  <tbody>
                    {[[0, [1, 2, 3]], [1, [7, 8, 9]], [2, [4, 5, 6]]].map(([h, cs]) => (
                      <tr key={h}>
                        <td>{h}개</td>
                        {cs.map((c) => (
                          <td key={c} className="r" title={CASES[c - 1]}>
                            <b>가설 {c}</b><br /><span className="caption">가운데 {CASE_GUIDE[c - 1].shape[1]}개</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="caption" style={{ marginTop: 8 }}>칸마다 나머지는 가운데 번호로 채워 6개를 맞춥니다.</p>
            </div>
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
                <p className="case-formula">후보 조합 수 = {g.formula} − 제외 조합</p>
                {next && (
                  <p className="case-now">{next.round}회 기준 후보 {next.candidates[i].toLocaleString()}개 ({pct((next.candidates[i] / 8145060) * 100)})</p>
                )}
              </div>
            ))}
          </div>
          <div className="case-legend" aria-hidden="true">
            <span><i className="pip p" />직전 회차 번호</span>
            <span><i className="pip c" />가운데 번호 (직전 회차 제외)</span>
            <span><i className="pip h" />많은 양끝 번호 (직전 회차 제외)</span>
          </div>
          <div className="setting-help">
            <div>
              <h3>케이스끼리의 관계</h3>
              <p>아홉 가설은 묶음별 개수(직전 회차 · 가운데 · 많은 양끝)가 모두 달라 서로 겹치지 않습니다. 한 회차는 많아야 한 가설에만 적중하고, 가설별 적중 횟수를 그대로 더해도 됩니다.</p>
              <p>직전 회차 번호는 가운데든 양끝이든 직전 회차 묶음으로만 셉니다. 예를 들어 직전 회차 번호이면서 많이 나온 번호는 ‘많은 양끝’이 아니라 ‘직전 회차’ 1개입니다.</p>
            </div>
            <div>
              <h3>어느 가설에도 들지 않는 회차</h3>
              <p>당첨 번호에 적은 양끝 번호가 하나라도 있거나, 직전 회차 번호가 3개 이상이거나, 많은 양끝 번호가 3개 이상이거나, 가운데 번호가 2개 이하이면 적중 없음입니다.</p>
              <p>a = 직전 회차를 뺀 가운데 번호 수, b = 직전 회차를 뺀 많은 양끝 번호 수, C(n, r) = n개 중 r개를 고르는 조합 수입니다. 직전 회차 번호 6개 중 1개는 6가지, 2개는 C(6, 2) = 15가지입니다. 후보가 많을수록 우연히도 자주 적중합니다.</p>
            </div>
          </div>

          <div className="exclude-block">
            <div className="section-head">
              <h3 className="display-xs">후보에서 빼는 조합</h3>
              <p>어느 케이스든 아래 세 가지 조합은 후보 조합 수에서 뺍니다. 기준은 단순합니다. 지금까지 실제로 거의 나오지 않았고, 빼도 후보가 거의 줄지 않는 조합만 골랐습니다. 회차별 판정에서는 그 회차 직전까지 나온 당첨 조합만 빼니 이번에도 미래를 엿보지 않습니다. 당첨 번호가 이런 조합이었다면 적중으로 치지 않습니다.</p>
            </div>
            <div className="case-grid">
              {(data?.exclusions ?? []).map((r) => {
                const g = EXCLUDE_GUIDE[r.key]
                if (!g) return null
                return (
                  <div className="feature-card case-card" key={r.key}>
                    <div className="title-md">{g.title}</div>
                    <p className="case-now" style={{ marginTop: 0 }}>{g.example}</p>
                    <p className="case-desc">{g.desc}</p>
                    <p className="case-formula">{g.count(r)}</p>
                    <p className="case-now">{data.totalDraws.toLocaleString()}개 회차 중 {g.expectLabel} {r.actual.toLocaleString()}번 · 무작위 기대 {r.expected.toFixed(1)}번</p>
                  </div>
                )
              })}
            </div>
            <div className="setting-help">
              <div>
                <h3>왜 이 조합들만 빼나요</h3>
                <p>홀수만 6개, 합계가 아주 작거나 큰 조합처럼 ‘왠지 안 나올 것 같은’ 모양도 따져 봤습니다. 그런데 이런 조합은 실제로 기대만큼, 때로는 기대보다 조금 더 나왔습니다. 그물에서 이걸 걷어 내면 진짜 당첨 번호까지 함께 버리게 되니 그대로 두었습니다.</p>
                {next && <p className="setting-now">{next.round}회 기준 제외 조합 {next.excluded.toLocaleString()}개 (전체 8,145,060개 중)</p>}
              </div>
              <div>
                <h3>빼면 당첨 확률이 오르나요</h3>
                <p>아니요. 빠진 조합도 1등 확률은 다른 조합과 똑같이 8,145,060분의 1입니다. 추첨기는 지난 결과도, 번호의 모양도 기억하지 못하니까요. 후보 목록을 덜 어색하게 다듬는 정리일 뿐, 행운을 끌어오는 장치는 아닙니다.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차별 판정</h2>
            <p>
              흐린 공은 그 회차 직전 기준 가운데 번호가 아닌 번호입니다. 케이스 칸 아래 숫자는 그 회차에서 그 케이스를 만족하는 전체 조합 수(후보 가짓수, 전체 8,145,060개 중, 제외 조합은 뺀 값)이고, 초록 숫자는 그중 5등 이상에 당첨되는 조합 수입니다. 회차를 누르면 케이스별 1등~5등 조합 수가 펼쳐집니다. 맨 오른쪽 칸은 당첨 번호 중 바로 직전 회차 당첨 번호와 겹친 개수와 그 번호입니다 (보너스 제외).
              {data && data.rows.length > 0 && ` 최신 회차부터 ${RECENT}회씩 보여주며, 맨 아래 더 보기로 이전 회차를 이어서 볼 수 있습니다.`}
            </p>
          </div>
          {data && data.rows.length > 0 && (
            <>
              <div className="first-grid">
                {data.stats.map((s) => (
                  <div className="feature-card first-card" key={s.caseNo} title={CASES[s.caseNo - 1]}>
                    <div className="case-no">케이스 {s.caseNo}</div>
                    <div className="first-stat"><b>{s.hits.toLocaleString()}</b>번</div>
                    <p className="caption">판정 {s.total.toLocaleString()}회 중 1등 조합이 후보에 들어 있던 회차</p>
                    <p className="case-now">무작위 기대 {s.expectedHits.toFixed(1)}번</p>
                  </div>
                ))}
              </div>
              <p className="note" style={{ marginTop: 0, marginBottom: 24 }}>
                전체 {data.rows.length.toLocaleString()}개 판정 회차({data.rows[0].round}회 ~ {data.rows[data.rows.length - 1].round}회)를 모두 모은 값입니다. 매 회차 그 케이스의 후보 조합을 전부 샀다면 1등에 당첨됐을 횟수와 같습니다.
              </p>
            </>
          )}
          <div className="feature-card">
            <div className="table-wrap">
              {rows.length === 0 ? (
                <p className="empty">표시할 회차가 없습니다.</p>
              ) : (
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>회차</th><th>번호</th><th className="r">가운데 수</th>
                      {CASES.map((t, i) => <th key={i} title={t}>케이스 {i + 1}</th>)}
                      <th className="r" title="당첨 번호 6개 중 바로 직전 회차 당첨 번호 6개와 겹치는 개수 (보너스 제외)">직전 회차 번호</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <Fragment key={a.round}>
                        <tr className={'clickable' + (open === a.round ? ' hl' : '')} onClick={() => setOpen(open === a.round ? null : a.round)}
                            aria-expanded={open === a.round}>
                          <td className="num">{a.round}</td>
                          <td><Balls numbers={a.numbers} bonus={a.bonus} dim={[...a.numbers, a.bonus].filter((n) => n != null && !a.center.includes(n))} /></td>
                          <td className="r num muted">{a.numbers.filter((n) => a.center.includes(n)).length} / {a.center.length}</td>
                          {a.hits.map((h, i) => {
                            const wins = a.prizes ? a.prizes[i].reduce((x, y) => x + y, 0) : null
                            return (
                              <td key={i} className={'case-cell ' + (h ? 'hit' : 'miss')}
                                  title={a.candidates ? `케이스 ${i + 1} 후보 ${a.candidates[i].toLocaleString()}개 조합` : undefined}>
                                <span>{h ? '적중' : '-'}</span>
                                {a.candidates && <span className="case-count">{a.candidates[i].toLocaleString()}개</span>}
                                {wins != null && a.candidates[i] > 0 && <span className="case-win">5등↑ {wins.toLocaleString()}</span>}
                              </td>
                            )
                          })}
                          <td className="r case-cell" title={a.prevRepeat?.length ? `직전 회차에도 나온 번호: ${a.prevRepeat.join(', ')}` : undefined}>
                            {a.prevRepeat == null ? <span className="muted">-</span> : a.prevRepeat.length === 0 ? (
                              <span className="muted">없음</span>
                            ) : (
                              <>
                                <span className="num" style={{ fontWeight: 600 }}>포함 {a.prevRepeat.length}개</span>
                                <span className="case-count">{a.prevRepeat.join(', ')}</span>
                              </>
                            )}
                          </td>
                        </tr>
                        {open === a.round && a.prizes && (
                          <tr className="prize-detail">
                            <td colSpan={4 + CASES.length}>
                              <table className="prize-table">
                                <thead>
                                  <tr><th>{a.round}회 케이스</th><th>후보 조합</th>{RANKS.map((r) => <th key={r}>{r}</th>)}<th>5등 이상</th><th>5등 이상 확률</th></tr>
                                </thead>
                                <tbody>
                                  {a.prizes.map((p, i) => {
                                    const sum = p.reduce((x, y) => x + y, 0)
                                    const cand = a.candidates[i]
                                    return (
                                      <tr key={i}>
                                        <td title={CASES[i]}>케이스 {i + 1}</td>
                                        <td>{cand.toLocaleString()}</td>
                                        {p.map((c, r) => <td key={r}>{c.toLocaleString()}</td>)}
                                        <td>{sum.toLocaleString()}</td>
                                        <td>{cand > 0 ? pct((sum / cand) * 100, 3) : '-'}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                              {a.bonus == null && <p className="caption" style={{ marginTop: 8 }}>이 회차는 보너스 번호가 없어 2등을 3등으로 셌습니다.</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {data && data.rows.length > 0 && (
              <div className="more-bar">
                <span className="caption">
                  {rows.length.toLocaleString()} / {data.rows.length.toLocaleString()}회 표시
                  {rows.length > 0 && ` (${rows[0].round}회 ~ ${rows[rows.length - 1].round}회)`}
                </span>
                {hidden > 0 ? (
                  <div className="form-actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setVisible(visible + RECENT)}>
                      이전 {Math.min(RECENT, hidden)}회 더 보기
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={() => setVisible(data.rows.length)}>
                      전체 보기 (남은 {hidden.toLocaleString()}회)
                    </button>
                  </div>
                ) : (
                  visible > RECENT && (
                    <button className="btn btn-secondary" type="button" onClick={() => setVisible(RECENT)}>최근 {RECENT}회만 보기</button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
