import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchGameRanking, fetchMyGame, startGameRun, submitGameScore } from '../api.js'
import { useAuth } from '../auth.js'
import { ballRange } from '../ball.js'
import { subscribeStream } from '../stream.js'

// 공 점프 러너: 로또 공이 굴러가며 '꽝' 쪽지를 뛰어넘는 미니 게임.
// 점수 규칙(초당 최대 점수)은 서버 GameService.MAX_POINTS_PER_SEC 와 맞춰야 합니다.

const H = 210
const GROUND = H - 34
const R = 17                 // 공 반지름
const BALL_X = 72
const GRAVITY = 2300
const JUMP_V = -780
const SPEED_START = 300      // px/s
const SPEED_MAX = 840
const SPEED_UP = 9           // 초당 가속
const PX_PER_POINT = 40      // 최고 속도에서 초당 21점
const BALL_COLORS = { 1: '#fbc400', 2: '#69c8f2', 3: '#ff7272', 4: '#aaaaaa', 5: '#b0d840' }

const QUIPS = [
  '번호는 안 맞아도 점프 타이밍은 맞췄잖아요',
  '꽝은 로또에서만 충분합니다',
  '814만분의 1보다는 쉬운 게임이에요',
  '이번 주 운은 토요일을 위해 아껴 두는 걸로',
  '꽝 쪽지에 걸려 넘어졌어요. 익숙한 느낌이죠?',
  '공은 굴러가고, 꿈도 굴러갑니다',
]

const newBallNo = () => 1 + Math.floor(Math.random() * 45)
const pick = (list) => list[Math.floor(Math.random() * list.length)]

function freshGame(ballNo) {
  return { state: 'ready', y: GROUND - R, vy: 0, t: 0, dist: 0, score: 0, speed: SPEED_START,
    obstacles: [], nextIn: 520, ballNo, buffer: 0, quip: '' }
}

export default function BallRunner() {
  const { me } = useAuth()
  const loggedIn = !!me?.loggedIn
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const game = useRef(freshGame(newBallNo()))
  const run = useRef(null)          // 서버 판 번호 Promise (로그인했을 때만)
  const [phase, setPhase] = useState('ready')
  const [lastScore, setLastScore] = useState(null)
  const [ranking, setRanking] = useState(null)
  const [mine, setMine] = useState(null)
  const [msg, setMsg] = useState(null)

  // ----- 순위 (실시간) -----
  useEffect(() => {
    let alive = true
    const load = () => fetchGameRanking().then((d) => alive && setRanking(d.ranking)).catch(() => {})
    load()
    const off = subscribeStream('/api/game/stream', ['ranking'], (name, data) => {
      if (name === 'reconnect') load()
      else setRanking(data.ranking)
    })
    return () => { alive = false; off() }
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    fetchMyGame().then((d) => alive && setMine(d)).catch(() => {})
    return () => { alive = false }
  }, [loggedIn, me?.username])

  // ----- 게임 진행 -----
  const finish = useCallback(async (score) => {
    setLastScore(score)
    setPhase('over')
    if (!run.current) return
    const pending = run.current
    run.current = null
    try {
      const { runId } = await pending
      const r = await submitGameScore(runId, score)
      setMine({ best: r.best, plays: r.plays, rank: r.rank, newBest: r.newBest })
      setRanking(r.ranking)
    } catch (e) {
      setMsg(e.message)
    }
  }, [])

  const start = useCallback(() => {
    const g = freshGame(newBallNo())
    g.state = 'running'
    game.current = g
    setPhase('running')
    setMsg(null)
    setMine((m) => m && { ...m, newBest: false })
    if (loggedIn) {
      run.current = startGameRun()
      run.current.catch(() => {})   // 실패는 끝날 때 처리
    }
  }, [loggedIn])

  const jump = useCallback(() => {
    const g = game.current
    if (g.state !== 'running') {
      if (g.state === 'over' && performance.now() - g.overAt < 600) return   // 부딪히자마자 연타로 바로 재시작되지 않게
      start()
      return
    }
    if (g.y >= GROUND - R - 0.5) g.vy = JUMP_V
    else g.buffer = 0.12   // 착지 직전에 누른 점프는 착지하자마자 뛴다
  }, [start])

  const onKeyDown = (e) => {
    const running = game.current.state === 'running'
    if (e.code === 'Space' || e.code === 'ArrowUp' || (e.code === 'Tab' && running) || (e.code === 'Enter' && !running)) {
      e.preventDefault()
      if (!e.repeat || running) jump()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let width = 600
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      width = Math.max(280, wrapRef.current.clientWidth)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrapRef.current)

    let raf
    let prev = performance.now()
    const frame = (now) => {
      // 탭을 가렸다 돌아오면 그동안은 멈춘 것으로 (점수가 시간보다 앞서지 않게)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const g = game.current
      if (g.state === 'running') step(g, dt, width)
      if (g.state === 'crashed') {
        g.state = 'over'
        g.overAt = now
        g.quip = pick(QUIPS)
        finish(g.score)
      }
      draw(ctx, g, width, now / 1000)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [finish])

  const myRankText = mine?.rank ? `내 순위 ${mine.rank}위 · 최고 ${mine.best.toLocaleString()}점` : '아직 기록이 없어요'
  const amFirst = loggedIn && ranking?.[0]?.username === me.username

  return (
    <section className="section band-soft" id="runner">
      <div className="container">
        <div className="section-head">
          <h2 className="display-sm">공 점프 러너</h2>
          <p>
            로또 1등은 못 했지만, 여기서는 내가 1등이지. 굴러가는 로또 공으로 <b>꽝</b> 쪽지를 뛰어넘으세요.
            <span className="kbd">Space</span> <span className="kbd">Tab</span> <span className="kbd">↑</span> 또는 화면을 눌러 점프합니다.
          </p>
        </div>

        <div className="runner-layout">
          <div className="runner-card">
            <div className="runner-stage" ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown}
                 onPointerDown={(e) => { e.currentTarget.focus(); jump() }}
                 role="application" aria-label="공 점프 러너 게임. 스페이스나 탭으로 점프">
              <canvas ref={canvasRef} />
            </div>
            <div className="runner-foot">
              {phase === 'over' && lastScore != null ? (
                <span>
                  <b className="num">{lastScore.toLocaleString()}점</b>
                  {mine?.newBest && <span className="role-badge win" style={{ marginLeft: 8 }}>최고 기록!</span>}
                </span>
              ) : <span className="caption">{phase === 'running' ? '달리는 중…' : '준비되면 시작하세요'}</span>}
              <button className="btn btn-primary btn-sm" type="button"
                      onClick={() => { wrapRef.current.focus(); start() }} disabled={phase === 'running'}>
                {phase === 'over' ? '다시 하기' : '시작'}
              </button>
            </div>
            {msg && <p className="notice" style={{ margin: '0 20px 16px' }}>{msg}</p>}
          </div>

          <aside className="runner-rank">
            <div className="runner-rank-head">
              <h3>오늘의 진짜 1등</h3>
              <span className="caption"><span className="live-dot on" />실시간 TOP 5</span>
            </div>
            {amFirst && <p className="runner-crown">👑 로또 1등은 아니지만, 이건 당신이 1등이에요!</p>}
            <ol className="rank-list">
              {!ranking && <li className="caption">불러오는 중…</li>}
              {ranking && ranking.length === 0 && <li className="caption">아직 기록이 없어요. 첫 1등의 자리가 비어 있습니다.</li>}
              {ranking && ranking.map((r) => (
                <li key={r.username} className={(loggedIn && r.username === me.username ? 'me ' : '') + 'rank-' + r.rank}>
                  <span className="rank-no">{r.rank === 1 ? '👑' : r.rank}</span>
                  <span className="rank-name">{r.username}</span>
                  <span className="rank-score num">{r.best.toLocaleString()}</span>
                </li>
              ))}
            </ol>
            <div className="runner-rank-me caption">
              {loggedIn
                ? myRankText
                : <>점수를 순위에 올리려면 <Link to="/login">로그인</Link>하세요. 게임은 누구나 할 수 있어요.</>}
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

// ----- 게임 계산 -----
function step(g, dt, width) {
  g.t += dt
  g.speed = Math.min(SPEED_MAX, SPEED_START + g.t * SPEED_UP)
  const dx = g.speed * dt
  g.dist += dx
  g.score = Math.floor(g.dist / PX_PER_POINT)

  // 공
  g.vy += GRAVITY * dt
  g.y += g.vy * dt
  if (g.y >= GROUND - R) {
    g.y = GROUND - R
    g.vy = 0
    if (g.buffer > 0) { g.vy = JUMP_V; g.buffer = 0 }
  }
  if (g.buffer > 0) g.buffer = Math.max(0, g.buffer - dt)

  // 장애물: 꽝 쪽지 (가끔 두 장 붙어 있음)
  for (const o of g.obstacles) o.x -= dx
  g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10)
  g.nextIn -= dx
  if (g.nextIn <= 0) {
    const count = g.t > 12 && Math.random() < 0.3 ? 2 : 1
    let x = width + 20
    for (let i = 0; i < count; i++) {
      const w = 20 + Math.random() * 14
      const h = 26 + Math.random() * (g.t > 20 ? 30 : 18)
      g.obstacles.push({ x, w, h, tilt: (Math.random() - 0.5) * 0.12 })
      x += w + 4
    }
    // 공이 한 번 점프하는 동안 움직이는 거리보다 간격을 넉넉히 둔다
    g.nextIn = g.speed * (0.85 + Math.random() * 0.9) + 120
  }

  // 충돌 (조금 너그럽게)
  const r = R * 0.82
  for (const o of g.obstacles) {
    const cx = Math.max(o.x, Math.min(BALL_X, o.x + o.w))
    const cy = Math.max(GROUND - o.h, Math.min(g.y, GROUND))
    if ((BALL_X - cx) ** 2 + (g.y - cy) ** 2 < r * r) { g.state = 'crashed'; break }
  }
}

// ----- 그리기 -----
function draw(ctx, g, width, time) {
  ctx.clearRect(0, 0, width, H)
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#eef4ff')
  sky.addColorStop(1, '#ffffff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, H)

  // 멀리 지나가는 숫자 (배경)
  ctx.font = '600 22px "JetBrains Mono", monospace'
  ctx.fillStyle = 'rgba(0, 82, 255, 0.07)'
  const off = (g.dist * 0.25) % 160
  for (let x = -off, i = Math.floor(g.dist * 0.25 / 160); x < width + 160; x += 160, i++) {
    ctx.fillText(String(((i * 17) % 45) + 1), x + 40, 52 + ((i * 37) % 3) * 22)
  }

  // 땅
  ctx.strokeStyle = '#c9ced6'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(width, GROUND + 1); ctx.stroke()
  ctx.fillStyle = '#dee1e6'
  const doff = g.dist % 28
  for (let x = -doff; x < width; x += 28) ctx.fillRect(x, GROUND + 10, 12, 2)

  // 꽝 쪽지
  for (const o of g.obstacles) {
    ctx.save()
    ctx.translate(o.x + o.w / 2, GROUND)
    ctx.rotate(o.tilt)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#7c828a'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.roundRect(-o.w / 2, -o.h, o.w, o.h, 3); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#cf202f'
    ctx.font = '700 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('꽝', 0, -o.h / 2 + 4)
    ctx.restore()
  }

  // 공 (그림자 → 공 → 굴러가는 번호)
  const lift = GROUND - R - g.y
  ctx.fillStyle = `rgba(0, 0, 0, ${0.14 * Math.max(0.3, 1 - lift / 140)})`
  ctx.beginPath(); ctx.ellipse(BALL_X, GROUND + 2, R * Math.max(0.5, 1 - lift / 200), 4, 0, 0, Math.PI * 2); ctx.fill()

  const bob = g.state === 'ready' ? Math.abs(Math.sin(time * 3)) * -10 : 0
  const y = g.y + bob
  ctx.fillStyle = BALL_COLORS[ballRange(g.ballNo)]
  ctx.beginPath(); ctx.arc(BALL_X, y, R, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath(); ctx.arc(BALL_X - 5, y - 6, R * 0.35, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.translate(BALL_X, y)
  ctx.rotate(g.dist / R)
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(0, 0, R * 0.58, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#0a0b0d'
  ctx.font = '700 12px "JetBrains Mono", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(g.ballNo), 0, 1)
  ctx.restore()

  // 점수
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#0a0b0d'
  ctx.font = '600 16px "JetBrains Mono", monospace'
  ctx.fillText(String(g.score).padStart(5, '0'), width - 16, 28)

  // 안내 문구
  ctx.textAlign = 'center'
  if (g.state === 'ready') {
    ctx.fillStyle = '#0a0b0d'
    fitText(ctx, '로또 1등은 아니어도, 여기선 1등 할 수 있다', width, 74, 700, 18)
    ctx.fillStyle = '#5b616e'
    fitText(ctx, 'Space · Tab · ↑ · 화면 터치로 시작하고 점프', width, 100, 500, 14)
  } else if (g.state === 'over') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
    ctx.fillRect(0, 0, width, H)
    ctx.fillStyle = '#cf202f'
    ctx.font = '800 28px sans-serif'
    ctx.fillText('꽝!', width / 2, 64)
    ctx.fillStyle = '#0a0b0d'
    fitText(ctx, g.quip, width, 94, 600, 16)
    ctx.fillStyle = '#5b616e'
    fitText(ctx, 'Space · Enter · 화면 터치로 다시 하기', width, 120, 500, 13)
  }
  ctx.textAlign = 'left'
}

// 가운데 정렬 문구를 화면 폭에 맞게 (좁은 휴대폰에서는 글자를 줄임)
function fitText(ctx, text, width, y, weight, size) {
  let px = size
  ctx.font = `${weight} ${px}px sans-serif`
  while (px > 10 && ctx.measureText(text).width > width - 32) {
    px -= 1
    ctx.font = `${weight} ${px}px sans-serif`
  }
  ctx.fillText(text, width / 2, y)
}
