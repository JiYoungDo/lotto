import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDraws } from '../api.js'
import { useAuth } from '../auth.js'
import PoolStatus from '../components/PoolStatus.jsx'
import BallRunner from '../components/BallRunner.jsx'
import CatchGame from '../components/CatchGame.jsx'
import AdSlot from '../components/AdSlot.jsx'
import Balls from '../components/Balls.jsx'
import { useDrawEvents } from '../drawEvents.js'
import { formatDrawDate, pad2, useCountdown } from '../drawDate.js'

// 회차 번호 화면: 최신 당첨 번호 + 다음 회차 남은 조합 현황
export default function Draws() {
  const { me } = useAuth()
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
  const next = data?.nextDraw
  const cd = useCountdown(next)

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">회차 데이터</span>
            <h1 className="display-mega">이번 회차<br />번호 현황</h1>
            <p className="lead">최신 당첨 번호와, 다음 회차에서 가설별로 아직 남아 있는 조합을 확인하세요. 쌓인 데이터로 가설이 맞았는지는 가설 분석에서 볼 수 있습니다.</p>
            <div className="hero-actions">
              {me?.loggedIn
                ? <Link className="btn btn-primary btn-lg" to="/mypage#make">내 번호 만들기</Link>
                : <Link className="btn btn-primary btn-lg" to="/try">가입 없이 번호 만들어 보기</Link>}
              <Link className="btn btn-outline-dark btn-lg" to="/analysis">가설 분석 보기</Link>
            </div>
            {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
          </div>
          <div className="hero-cards">
            <div className="card-dark card-back">
              <div className="card-label">최신 회차</div>
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 4 }}>{latest ? `${latest.round}회` : '-'}</div>
              <div className="card-label">{latest ? formatDrawDate(latest.date) : ''}</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">{next ? `${next.round}회 추첨까지` : '다음 추첨까지'}</div>
              <div className="card-stat" style={{ marginBottom: 8 }}>
                {!cd ? '-' : cd.over ? '추첨 완료' : cd.dday <= 0 ? 'D-DAY' : `D-${cd.dday}`}
              </div>
              {cd && (cd.over ? (
                <p className="countdown-note">추첨이 끝났어요. 당첨 번호가 등록되면 바로 바뀝니다.</p>
              ) : (
                <div className="countdown-clock num" role="timer" aria-live="off">
                  {cd.days > 0 && <>{cd.days}<small>일</small></>}
                  {pad2(cd.hours)}<small>시간</small>{pad2(cd.minutes)}<small>분</small>{pad2(cd.seconds)}<small>초</small>
                </div>
              ))}
              <div className="card-row"><span>추첨 일시</span><span className="num">{next ? `${formatDrawDate(next.date)} 20:35` : '-'}</span></div>
              <div className="card-row"><span>저장된 회차</span><span className="num">{data ? data.total.toLocaleString() : '-'}</span></div>
              <div className="card-row" style={{ paddingBottom: 8 }}>
                <span>{latest ? `${latest.round}회 당첨 번호` : '최신 당첨 번호'}</span>
                <span className="num">{latest ? formatDrawDate(latest.date) : ''}</span>
              </div>
              <div>{latest ? <Balls numbers={latest.numbers} bonus={latest.bonus} /> : <span className="num">-</span>}</div>
              {latest && <p style={{ marginTop: 12, fontSize: 14 }}><Link to={`/draw/${latest.round}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{latest.round}회 자세히 보기 →</Link></p>}
            </div>
          </div>
        </div>
      </section>

      <PoolStatus />
      <AdSlot type="inline" />
      <BallRunner />
      <CatchGame />
    </>
  )
}
