import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchDraw } from '../api.js'
import AdSlot from '../components/AdSlot.jsx'
import Balls from '../components/Balls.jsx'
import { formatDrawDate } from '../drawDate.js'
import { useSeo } from '../useSeo.js'

// 회차 한 건의 화면 (/draw/1150). 서버가 같은 주소로 검색용 HTML도 내려줍니다 (DrawPageController).
export default function DrawDetail() {
  const { round: roundParam } = useParams()
  const round = /^\d{1,6}$/.test(roundParam || '') ? Number(roundParam) : null
  const [result, setResult] = useState(null)   // { round, data } 또는 { round, error }

  useEffect(() => {
    if (round == null) return undefined
    let live = true
    fetchDraw(round)
      .then((d) => { if (live) setResult({ round, data: d }) })
      .catch((e) => { if (live) setResult({ round, error: e }) })
    return () => { live = false }
  }, [round])

  // 다른 회차로 넘어가는 동안에는 이전 회차 내용을 보여 주지 않는다
  const data = result?.round === round ? result.data ?? null : null
  const error = result?.round === round ? result.error ?? null : null

  const shortDate = data ? data.date.replaceAll('-', '.') : ''
  useSeo(
    data ? `${data.round}회 로또 당첨번호 (추첨일 ${shortDate})` : round ? `${round}회 로또 당첨번호` : '로또 당첨번호',
    data ? `${data.round}회 로또 당첨번호 ${data.numbers.join(', ')}${data.bonus != null ? `, 보너스 번호 ${data.bonus}` : ''} (추첨일 ${shortDate}). 번호 합계, 홀짝·고저 비율, 직전 회차와 겹친 번호를 확인하세요.` : '',
  )

  if (round == null || error?.status === 404) {
    return (
      <section className="section">
        <div className="container legal-doc">
          <h1 className="display-sm">{round == null ? '잘못된 회차 주소예요' : `${round}회는 아직 없어요`}</h1>
          <p style={{ marginTop: 12 }}>아직 등록되지 않았거나 없는 회차입니다. 최근 회차는 <Link to="/draws">첫 화면</Link>에서 볼 수 있어요.</p>
        </div>
      </section>
    )
  }
  if (error) {
    return (
      <section className="section">
        <div className="container legal-doc"><p className="notice">서버에 연결하지 못했어요: {error.message}</p></div>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="section">
        <div className="container legal-doc"><p className="caption">불러오는 중…</p></div>
      </section>
    )
  }

  const even = 6 - data.odd
  const high = 6 - data.low
  return (
    <>
      <section className="section">
        <div className="container legal-doc">
          <div className="section-head">
            <p className="caption"><Link to="/draws">← 회차 번호</Link></p>
            <h1 className="display-sm">{data.round}회 로또 당첨번호</h1>
            <p className="caption">추첨일 {formatDrawDate(data.date)} 20:35</p>
          </div>

          <div className="balls" style={{ marginBottom: 24 }}>
            <Balls numbers={data.numbers} bonus={data.bonus} />
          </div>

          <table className="legal-table">
            <tbody>
              <tr><td>번호 합계</td><td>{data.sum} (보너스 제외)</td></tr>
              <tr><td>홀수 : 짝수</td><td>{data.odd} : {even}</td></tr>
              <tr><td>낮은 번호 : 높은 번호</td><td>{data.low} : {high} (1~22 / 23~45)</td></tr>
              <tr>
                <td>직전 회차와 겹친 번호</td>
                <td>{data.repeated.length === 0 ? '없음' : `${data.repeated.join(', ')} (${data.repeated.length}개)`}</td>
              </tr>
            </tbody>
          </table>
          <p className="caption">직전 회차(보너스 제외) 당첨 번호 중 이번 회차에 다시 나온 번호입니다. 무작위로 뽑아도 평균 0.8개 정도 겹칩니다.</p>

          <div className="draw-nav">
            {data.hasPrev ? <Link className="btn btn-secondary btn-sm" to={`/draw/${data.round - 1}`}>← {data.round - 1}회</Link> : <span />}
            {data.hasNext ? <Link className="btn btn-secondary btn-sm" to={`/draw/${data.round + 1}`}>{data.round + 1}회 →</Link> : <span />}
          </div>

          <p>이 회차를 포함한 전체 데이터로 번호 출현 횟수와 가설이 얼마나 맞았는지 보려면 <Link to="/analysis">가설 분석</Link>을, 숫자를 읽는 방법은 <Link to="/guide/test-hypothesis">가이드</Link>를 확인하세요.</p>
          <p className="caption legal-foot">이 정보는 오락·학습용이며 당첨을 보장하거나 확률을 높이지 않습니다. 만 19세 미만은 이용할 수 없습니다.</p>
        </div>
      </section>
      <AdSlot key={data.round} type="inline" />
    </>
  )
}
