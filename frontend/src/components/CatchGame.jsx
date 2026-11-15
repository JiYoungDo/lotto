import { useCallback, useEffect, useRef, useState } from 'react'
import { ballRange } from '../ball.js'
import { BALL_COLORS, drawBall, fitCanvas, fitText, pick, useGameScores } from '../gameScores.js'
import GameRanking, { GameFoot } from './GameRanking.jsx'

// 번호 캐치: 위에서 1~45 공이 떨어지고, 바구니를 좌우로 움직여 '목표 색' 공만 받는 반응 속도 게임.
// 공 색은 로또 공 색 구간(1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록)을 그대로 씁니다.
// 10초마다 레벨이 오르면 목표 색이 바뀌고, 공이 더 빨리, 더 자주 떨어집니다.
// 점수 규칙(공 하나 최대 20점)은 서버 GameService.GAMES 의 catch 와 맞춰야 합니다.

const H = 380
const R = 18                  // 공 반지름
const BASKET_W = 86
const BASKET_H = 16
const BASKET_Y = H - 34       // 바구니 윗면
const LIVES = 3
const LEVEL_SEC = 10
const MAX_LEVEL = 10
const TARGET_RATIO = 0.45     // 떨어지는 공 중 목표 색 공 비율
const SWITCH_PAUSE = 1.0      // 목표 색이 바뀐 뒤 새 공이 나오기까지 쉬는 시간(초)

// 색 구간: ballRange(번호) 값 1~5
const BANDS = [
  null,
  { name: '노란 공', label: '1~10', from: 1, to: 10, text: '#3d2f00' },
  { name: '파란 공', label: '11~20', from: 11, to: 20, text: '#05324a' },
  { name: '빨간 공', label: '21~30', from: 21, to: 30, text: '#4a0a0a' },
  { name: '회색 공', label: '31~40', from: 31, to: 40, text: '#1f2226' },
  { name: '초록 공', label: '41~45', from: 41, to: 45, text: '#243300' },
]

const QUIPS = [
  '색깔만 맞추면 되는데… 로또도 이랬으면 좋겠네요',
  '이 반응 속도면 추첨기 공도 잡겠어요',
  '노랑 파랑 빨강 회색 초록, 다음엔 다 잡아 봐요',
  '번호 고르는 손맛은 로또보다 낫네요',
  '놓친 공은 다음 주 추첨기에서 다시 만나요',
]

const randomIn = (band) => band.from + Math.floor(Math.random() * (band.to - band.from + 1))
const nextTarget = (current) => pick([1, 2, 3, 4, 5].filter((b) => b !== current))

function freshGame(width) {
  return { state: 'ready', t: 0, level: 1, levelAt: -10, score: 0, combo: 0, lives: LIVES, caught: 0,
    x: width / 2, balls: [], nextIn: 0.6, pops: [], shake: 0, quip: '', target: nextTarget(0) }
}

const levelOf = (t) => Math.min(MAX_LEVEL, 1 + Math.floor(t / LEVEL_SEC))

export default function CatchGame() {
  const scores = useGameScores('catch')
  const { begin, end } = scores
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const widthRef = useRef(600)
  const game = useRef(freshGame(600))
  const keys = useRef({ left: false, right: false })
  const [phase, setPhase] = useState('ready')
  const [result, setResult] = useState(null)

  const finish = useCallback((g) => {
    setResult({ score: g.score, level: g.level })
    setPhase('over')
    end(g.score)
  }, [end])

  const start = useCallback(() => {
    const g = freshGame(widthRef.current)
    g.state = 'running'
    game.current = g
    setPhase('running')
    begin()
  }, [begin])

  const tryStart = () => {
    const g = game.current
    if (g.state === 'running') return
    if (g.state === 'over' && performance.now() - g.overAt < 600) return
    start()
  }

  const setKey = (e, down) => {
    const k = e.code
    if (k === 'ArrowLeft' || k === 'KeyA') { keys.current.left = down; e.preventDefault() }
    else if (k === 'ArrowRight' || k === 'KeyD') { keys.current.right = down; e.preventDefault() }
    else if (down && (k === 'Space' || k === 'Enter')) {
      e.preventDefault()
      if (!e.repeat) tryStart()
    }
  }

  // 마우스·터치: 바구니가 손가락(포인터)을 따라감
  const follow = (e) => {
    const g = game.current
    if (g.state !== 'running') return
    if (e.pointerType !== 'mouse' && e.buttons === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    g.x = clampX(e.clientX - rect.left, widthRef.current)
  }

  useEffect(() => {
    const { ctx, size, stop } = fitCanvas(canvasRef.current, wrapRef.current, H)
    let raf
    let prev = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      widthRef.current = size.width
      const g = game.current
      if (g.state === 'ready') g.x = size.width / 2
      if (g.state === 'running') step(g, dt, size.width, keys.current)
      if (g.state === 'dead') {
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
    <section className="section" id="catch">
      <div className="container">
        <div className="section-head">
          <h2 className="display-sm">번호 캐치</h2>
          <p>
            위에서 1~45 공이 떨어집니다. 바구니를 좌우로 움직여 <b>목표 색 공</b>만 받으세요.
            다른 색 공을 받거나 목표 색 공을 놓치면 목숨이 하나 줄어요 (목숨 {LIVES}개).
            <span className="kbd">←</span> <span className="kbd">→</span> <span className="kbd">A</span> <span className="kbd">D</span> 또는
            마우스·손가락으로 움직입니다. {LEVEL_SEC}초마다 목표 색이 바뀌고 공이 더 빨리, 더 자주 떨어지니 반응 속도가 승부예요.
          </p>
        </div>

        <div className="catch-center">
          <span className="caption">공 색 구분</span>
          <div className="band-legend">
            {BANDS.slice(1).map((b, i) => (
              <span key={b.name} className="band-chip">
                <span className={`ball r${i + 1}`}>{b.from}</span>
                <span><b>{b.name.replace(' 공', '')}</b> {b.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="runner-layout">
          <div className="runner-card">
            <div className="runner-stage catch-stage" ref={wrapRef} tabIndex={0}
                 onKeyDown={(e) => setKey(e, true)} onKeyUp={(e) => setKey(e, false)}
                 onBlur={() => { keys.current = { left: false, right: false } }}
                 onPointerDown={(e) => { e.currentTarget.focus(); tryStart(); follow(e) }}
                 onPointerMove={follow}
                 role="application" aria-label="번호 캐치 게임. 왼쪽 오른쪽 화살표로 바구니 이동">
              <canvas ref={canvasRef} />
            </div>
            <GameFoot phase={phase} result={result} scores={scores} runningText="받는 중…"
                      onStart={() => { wrapRef.current.focus(); start() }} />
          </div>
          <GameRanking title="캐치 1등" scores={scores} />
        </div>
      </div>
    </section>
  )
}

const clampX = (x, width) => Math.max(BASKET_W / 2 + 4, Math.min(width - BASKET_W / 2 - 4, x))

// ----- 게임 계산 -----
function step(g, dt, width, keys) {
  g.t += dt
  const L = levelOf(g.t)
  if (L !== g.level) {
    // 레벨 업: 목표 색을 바꾸고, 떨어지던 공은 정리해서 헷갈리지 않게
    g.level = L
    g.levelAt = g.t
    g.target = nextTarget(g.target)
    g.balls = []
    g.nextIn = SWITCH_PAUSE
  }

  // 바구니: 레벨이 오를수록 조금 빨라짐 (공도 빨라지니까)
  const move = 520 + 35 * L
  if (keys.left) g.x -= move * dt
  if (keys.right) g.x += move * dt
  g.x = clampX(g.x, width)

  // 새 공: 레벨이 오를수록 더 자주, 더 빨리
  g.nextIn -= dt
  if (g.nextIn <= 0) {
    const band = Math.random() < TARGET_RATIO ? g.target : nextTarget(g.target)
    const no = randomIn(BANDS[band])
    const fall = Math.min(560, 150 + 14 * g.t) + Math.random() * (20 + 12 * L)
    g.balls.push({ x: R + 6 + Math.random() * (width - 2 * R - 12), y: -R, no, vy: fall })
    const gap = Math.max(0.42, 1.05 - 0.065 * (L - 1))
    g.nextIn = gap * (0.8 + Math.random() * 0.4)
  }

  // 떨어짐 → 바구니에 닿았는지, 바닥으로 빠졌는지
  const left = g.x - BASKET_W / 2
  const right = g.x + BASKET_W / 2
  const keep = []
  for (const b of g.balls) {
    const hit = ballRange(b.no) === g.target
    const prevBottom = b.y + R
    b.y += b.vy * dt
    const bottom = b.y + R
    if (prevBottom <= BASKET_Y && bottom >= BASKET_Y && b.x >= left - R * 0.5 && b.x <= right + R * 0.5) {
      if (hit) {
        g.combo++
        const pts = 10 + Math.min(10, g.combo - 1)   // 연속으로 받으면 보너스 (최대 20점)
        g.score += pts
        g.caught++
        g.pops.push({ x: b.x, y: BASKET_Y - 10, text: `+${pts}`, color: '#05b169', t: 0 })
      } else {
        miss(g, b.x, `${b.no}번은 ${BANDS[ballRange(b.no)].name}!`)
      }
      continue
    }
    if (b.y - R > H) {
      if (hit) miss(g, b.x, `${b.no}번 놓침`)
      continue
    }
    keep.push(b)
  }
  g.balls = keep
  for (const p of g.pops) p.t += dt
  g.pops = g.pops.filter((p) => p.t < 0.9)
  g.shake = Math.max(0, g.shake - dt)
  if (g.lives <= 0) g.state = 'dead'
}

function miss(g, x, text) {
  g.lives--
  g.combo = 0
  g.shake = 0.25
  g.pops.push({ x: Math.max(50, x), y: Math.min(BASKET_Y - 10, H - 50), text, color: '#cf202f', t: 0 })
}

// ----- 그리기 -----
function draw(ctx, g, width, time) {
  const band = BANDS[g.target]
  const color = BALL_COLORS[g.target]
  ctx.save()
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * g.shake * 4, 0)
  ctx.clearRect(-10, 0, width + 20, H)
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#f4f7ff')
  sky.addColorStop(1, '#ffffff')
  ctx.fillStyle = sky
  ctx.fillRect(-10, 0, width + 20, H)

  // 공
  for (const b of g.balls) drawBall(ctx, b.x, b.y, R, b.no, Math.sin(time * 3 + b.x) * 0.3)

  // 바구니: 목표 색으로 칠함
  const bx = g.x - BASKET_W / 2
  ctx.fillStyle = color
  ctx.beginPath(); ctx.roundRect(bx, BASKET_Y, BASKET_W, BASKET_H, [4, 4, 12, 12]); ctx.fill()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = band.text
  ctx.font = '700 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${band.name.replace(' 공', '')}만!`, g.x, BASKET_Y + BASKET_H / 2 + 1)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
  ctx.beginPath(); ctx.ellipse(g.x, H - 10, BASKET_W / 2, 4, 0, 0, Math.PI * 2); ctx.fill()

  // 점수 팝업
  ctx.font = '800 15px sans-serif'
  for (const p of g.pops) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9)
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y - p.t * 40)
  }
  ctx.globalAlpha = 1

  // 목표 색 표시 (가운데 위)
  if (g.state === 'running') {
    const label = `${band.name} (${band.label})만 받기`
    ctx.font = '700 14px sans-serif'
    const w = ctx.measureText(label).width + 44
    const px = width / 2 - w / 2
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(px, 12, w, 30, 15); ctx.fill(); ctx.stroke()
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(px + 18, 27, 8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0a0b0d'
    ctx.textAlign = 'left'
    ctx.fillText(label, px + 32, 28)
  }

  // 점수·레벨·목숨·콤보
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
    ctx.fillStyle = '#cf202f'
    ctx.font = '14px sans-serif'
    ctx.fillText('♥'.repeat(Math.max(0, g.lives)) + '♡'.repeat(LIVES - Math.max(0, g.lives)), 16, 50)
    if (g.combo >= 2) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#05b169'
      ctx.font = '700 13px sans-serif'
      ctx.fillText(`${g.combo} 콤보`, width - 16, 48)
    }
  }
  // 레벨 업 → 새 목표 색 알림
  const since = g.t - g.levelAt
  if (g.state === 'running' && g.level > 1 && since < 1.6) {
    ctx.globalAlpha = Math.min(1, (1.6 - since) * 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#0052ff'
    ctx.font = '800 20px sans-serif'
    ctx.fillText(`LEVEL ${g.level} · 더 빨리!`, width / 2, 96)
    ctx.fillStyle = '#0a0b0d'
    fitText(ctx, `이번엔 ${band.name} (${band.label})!`, width, 124, 800, 18)
    ctx.globalAlpha = 1
  }

  // 안내 문구
  ctx.textAlign = 'center'
  if (g.state === 'ready') {
    ctx.fillStyle = '#0a0b0d'
    fitText(ctx, '목표 색 공만 받아라!', width, 140, 800, 22)
    ctx.fillStyle = '#5b616e'
    fitText(ctx, '← → · A D · 마우스/손가락으로 이동 · Space로 시작', width, 170, 500, 14)
    fitText(ctx, '로또 1등은 아니어도, 공 잡는 손은 내가 1등', width, 196, 500, 14)
  } else if (g.state === 'over') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
    ctx.fillRect(-10, 0, width + 20, H)
    ctx.fillStyle = '#cf202f'
    ctx.font = '800 28px sans-serif'
    ctx.fillText('게임 끝!', width / 2, 130)
    ctx.fillStyle = '#0a0b0d'
    fitText(ctx, `목표 색 공 ${g.caught}개를 받았어요`, width, 166, 700, 17)
    fitText(ctx, g.quip, width, 194, 500, 15)
    ctx.fillStyle = '#5b616e'
    fitText(ctx, 'Space · Enter · 화면 터치로 다시 하기', width, 222, 500, 13)
  }
  ctx.textAlign = 'left'
  ctx.restore()
}
