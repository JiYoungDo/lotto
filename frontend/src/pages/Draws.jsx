import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDraws } from '../api.js'
import PoolStatus from '../components/PoolStatus.jsx'
import BallRunner from '../components/BallRunner.jsx'
import CatchGame from '../components/CatchGame.jsx'
import Balls from '../components/Balls.jsx'
import { useDrawEvents } from '../drawEvents.js'

// 회차 번호 화면: 최신 당첨 번호 + 다음 회차 남은 조합 현황
export default function Draws() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  // 관리자가 회차를 등록·수정하면 최신 번호를 바로 다시 불러옴
  useDrawEvents(() => setTick((n) => n + 1))

  useEffect(() => {
    fetchDraws(1)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(e.message))
  }, [tick])

  const latest = data?.draws[0]

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">회차 데이터</span>
            <h1 className="display-mega">이번 회차<br />번호 현황</h1>
            <p className="lead">최신 당첨 번호와, 다음 회차에서 가설별로 아직 남아 있는 조합을 확인하세요. 쌓인 데이터로 가설이 맞았는지는 가설 분석에서 볼 수 있습니다.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/analysis">가설 분석 보기</Link>
              <a className="btn btn-outline-dark btn-lg" href="#pool">남은 조합 보기</a>
            </div>
            {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
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
      <BallRunner />
      <CatchGame />
    </>
  )
}
