import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGameRanking, fetchMyGame, startGameRun, submitGameScore } from './api.js'
import { useAuth } from './auth.js'
import { subscribeStream } from './stream.js'
import { ballRange } from './ball.js'

/**
 * 미니 게임 점수·순위 공통 처리.
 * begin(): 판 시작 (로그인했으면 서버에서 판 번호를 받아 둠), end(score): 판 끝 → 점수 기록.
 * ranking 은 실시간 스트림으로 다른 사람이 순위를 바꾸면 바로 바뀝니다.
 */
export function useGameScores(game) {
  const { me } = useAuth()
  const loggedIn = !!me?.loggedIn
  const run = useRef(null)          // 서버 판 번호 Promise (로그인했을 때만)
  const [ranking, setRanking] = useState(null)
  const [mine, setMine] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => fetchGameRanking(game).then((d) => alive && setRanking(d.ranking)).catch(() => {})
    load()
    const off = subscribeStream('/api/game/stream', ['ranking'], (name, data) => {
      if (name === 'reconnect') load()
      else if (data.game === game) setRanking(data.ranking)
    })
    return () => { alive = false; off() }
  }, [game])

  useEffect(() => {
    if (!loggedIn) return
    let alive = true
    fetchMyGame(game).then((d) => alive && setMine(d)).catch(() => {})
    return () => { alive = false }
  }, [game, loggedIn, me?.username])

  const begin = useCallback(() => {
    setMsg(null)
    setMine((m) => m && { ...m, newBest: false })
    if (loggedIn) {
      run.current = startGameRun(game)
      run.current.catch(() => {})   // 실패는 끝날 때 처리
    }
  }, [game, loggedIn])

  const end = useCallback(async (score) => {
    if (!run.current) return
    const pending = run.current
    run.current = null
    try {
      const { runId } = await pending
      const r = await submitGameScore(game, runId, score)
      setMine({ best: r.best, plays: r.plays, rank: r.rank, newBest: r.newBest })
      setRanking(r.ranking)
    } catch (e) {
      setMsg(e.message)
    }
  }, [game])

  return { me, loggedIn, ranking, mine, msg, begin, end }
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)]

// 가운데 정렬 문구를 화면 폭에 맞게 (좁은 휴대폰에서는 글자를 줄임)
export function fitText(ctx, text, width, y, weight, size) {
  let px = size
  ctx.font = `${weight} ${px}px sans-serif`
  while (px > 10 && ctx.measureText(text).width > width - 32) {
    px -= 1
    ctx.font = `${weight} ${px}px sans-serif`
  }
  ctx.fillText(text, width / 2, y)
}

export const BALL_COLORS = { 1: '#fbc400', 2: '#69c8f2', 3: '#ff7272', 4: '#aaaaaa', 5: '#b0d840' }

/** 캔버스를 감싼 요소 폭에 맞추고 화면 배율(dpr)을 적용. 정리 함수와 현재 폭을 돌려줌 */
export function fitCanvas(canvas, wrap, height) {
  const ctx = canvas.getContext('2d')
  const size = { width: 600 }
  const resize = () => {
    const dpr = window.devicePixelRatio || 1
    size.width = Math.max(280, wrap.clientWidth)
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.height = height + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(wrap)
  return { ctx, size, stop: () => ro.disconnect() }
}

/** 로또 공 하나 (번호 구간 색 + 흰 원 안의 번호). rot 만큼 번호가 돈다 */
export function drawBall(ctx, x, y, r, no, rot = 0) {
  ctx.fillStyle = BALL_COLORS[ballRange(no)]
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#0a0b0d'
  ctx.font = `700 ${Math.round(r * 0.7)}px "JetBrains Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(no), 0, 1)
  ctx.restore()
}
