import { useCallback, useEffect, useRef, useState } from 'react'
import { drawBall, fitCanvas, fitText, pick, useGameScores } from '../gameScores.js'
import GameRanking, { GameFoot } from './GameRanking.jsx'

// 공 점프 러너: 로또 공이 굴러가며 '꽝' 쪽지를 뛰어넘는 미니 게임.
// 10초마다 레벨이 올라 속도가 빨라지고 장애물 간격이 좁아집니다.
// 점수 규칙(초당 최대 점수)은 서버 GameService.GAMES 의 runner 와 맞춰야 합니다.

const H = 210
const GROUND = H - 34
const R = 17                 // 공 반지름
const BALL_X = 72
const GRAVITY = 2300
const JUMP_V = -780
const AIR_TIME = (2 * -JUMP_V) / GRAVITY   // 한 번 점프해서 떠 있는 시간 (약 0.68초)
const SPEED_START = 320      // px/s
const SPEED_MAX = 1000
const SPEED_UP = 12          // 초당 가속 → 약 57초에 최고 속도
const LEVEL_SEC = 10
const MAX_LEVEL = 10
const PX_PER_POINT = 40      // 최고 속도에서 초당 25점

const QUIPS = [
  '번호는 안 맞아도 점프 타이밍은 맞췄잖아요',
  '꽝은 로또에서만 충분합니다',
  '814만분의 1보다는 쉬운 게임이에요',
  '이번 주 운은 토요일을 위해 아껴 두는 걸로',
  '꽝 쪽지에 걸려 넘어졌어요. 익숙한 느낌이죠?',
  '공은 굴러가고, 꿈도 굴러갑니다',
]

const newBallNo = () => 1 + Math.floor(Math.random() * 45)

function freshGame(ballNo) {
  return { state: 'ready', y: GROUND - R, vy: 0, t: 0, dist: 0, score: 0, speed: SPEED_START, level: 1,
    levelAt: -10, obstacles: [], nextIn: 520, ballNo, buffer: 0, quip: '' }
}

export default function BallRunner() {
  const scores = useGameScores('runner')
  const { begin, end } = scores
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const game = useRef(freshGame(newBallNo()))
  const [phase, setPhase] = useState('ready')
  const [result, setResult] = useState(null)   // { score, level }

  const finish = useCallback((g) => {
    setResult({ score: g.score, level: g.level })
    setPhase('over')
    end(g.score)
  }, [end])

  const start = useCallback(() => {
    const g = freshGame(newBallNo())
    g.state = 'running'
    game.current = g
    setPhase('running')
    begin()
  }, [begin])

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
    const { ctx, size, stop } = fitCanvas(canvasRef.current, wrapRef.current, H)
    let raf
    let prev = performance.now()
    const frame = (now) => {
      // 탭을 가렸다 돌아오면 그동안은 멈춘 것으로 (점수가 시간보다 앞서지 않게)
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      const g = game.current
      if (g.state === 'running') step(g, dt, size.width)
      if (g.state === 'crashed') {
        g.state = 'over'
        g.overAt = now
        g.quip = pick(QUIPS)
        finish(g)
      }
      draw(ctx, g, size.width, now / 1000)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); stop() }
  }, [finish])

  return (
    <section className="section band-soft" id="runner">
      <div className="container">
        <div className="section-head">
          <h2 className="display-sm">공 점프 러너</h2>
          <p>
            로또 1등은 못 했지만, 여기서는 내가 1등이지. 굴러가는 로또 공으로 <b>꽝</b> 쪽지를 뛰어넘으세요.
            <span className="kbd">Space</span> <span className="kbd">Tab</span> <span className="kbd">↑</span> 또는 화면을 눌러 점프합니다.
            {' '}{LEVEL_SEC}초마다 레벨이 올라 점점 빨라지고, 쪽지 간격도 좁아집니다.
          </p>
        </div>

        <div className="runner-layout">
          <div className="runner-card">
            <div className="runner-stage" ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown}
                 onPointerDown={(e) => { e.currentTarget.focus(); jump() }}
                 role="application" aria-label="공 점프 러너 게임. 스페이스나 탭으로 점프">
              <canvas ref={canvasRef} />
            </div>
            <GameFoot phase={phase} result={result} scores={scores} runningText="달리는 중…"
                      onStart={() => { wrapRef.current.focus(); start() }} />
          </div>
          <GameRanking title="오늘의 진짜 1등" scores={scores} />
        </div>
      </div>
    </section>
  )
}

// ----- 게임 계산 -----
function step(g, dt, width) {
  g.t += dt
  g.speed = Math.min(SPEED_MAX, SPEED_START + g.t * SPEED_UP)
  const level = Math.min(MAX_LEVEL, 1 + Math.floor(g.t / LEVEL_SEC))
  if (level !== g.level) { g.level = level; g.levelAt = g.t }
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

  // 장애물: 꽝 쪽지. 레벨이 오를수록 여러 장 붙어 나오고 키가 커짐
  for (const o of g.obstacles) o.x -= dx
  g.obstacles = g.obstacles.filter((o) => o.x + o.w > -10)
  g.nextIn -= dx
  if (g.nextIn <= 0) {
    const L = g.level
    const roll = Math.random()
    const count = L >= 5 && roll < 0.12 ? 3 : L >= 2 && roll < 0.12 + Math.min(0.4, 0.05 * L) ? 2 : 1
    let x = width + 20
    for (let i = 0; i < count; i++) {
      const w = 20 + Math.random() * 14
      const h = 26 + Math.random() * Math.min(40, 14 + 4 * L)
      g.obstacles.push({ x, w, h, tilt: (Math.random() - 0.5) * 0.12 })
      x += w + 4
    }
    // 다음 쪽지까지 거리: 레벨이 오를수록 좁고 고르게. 그래도 한 번 점프해서 착지할 거리(AIR_TIME)는 항상 남긴다
    const lo = Math.max(AIR_TIME + 0.07, 0.95 - 0.025 * (L - 1))
    const spread = Math.max(0.3, 1.0 - 0.07 * (L - 1))
    g.nextIn = (x - width - 20) + g.speed * (lo + Math.random() * spread) + 70
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
  ctx.textAlign = 'left'
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
  drawBall(ctx, BALL_X, g.y + bob, R, g.ballNo, g.dist / R)

  // 점수·레벨
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#0a0b0d'
  ctx.font = '600 16px "JetBrains Mono", monospace'
  ctx.fillText(String(g.score).padStart(5, '0'), width - 16, 28)
  if (g.state !== 'ready') {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#0052ff'
    ctx.font = '700 13px "JetBrains Mono", monospace'
    ctx.fillText(`LV ${g.level}`, 16, 28)
  }
  // 레벨이 오르면 잠깐 알림
  const since = g.t - g.levelAt
  if (g.state === 'running' && g.level > 1 && since < 1.3) {
    ctx.globalAlpha = Math.min(1, (1.3 - since) * 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#0052ff'
    ctx.font = '800 20px sans-serif'
    ctx.fillText(`LEVEL ${g.level} · 속도 UP!`, width / 2, 64)
    ctx.globalAlpha = 1
  }

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
