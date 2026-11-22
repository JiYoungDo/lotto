import { useEffect, useState } from 'react'

// 추첨일 표시와 다음 추첨까지 남은 시간 (모두 한국 시간 기준)

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const FIRST = Date.UTC(2002, 11, 7) // 1회 추첨일 2002-12-07

/** 'yyyy-MM-dd' → '2026.11.21 (토)' */
export function formatDrawDate(date) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  const w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${w})`
}

/** 회차로 계산한 추첨일 (1회부터 매주 토요일) — 관리자 입력란 기본값 */
export function defaultDrawDate(round) {
  return new Date(FIRST + (round - 1) * 7 * 86400000).toISOString().slice(0, 10)
}

/** 지금 한국 날짜 'yyyy-MM-dd' */
function todayKst(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
}

const dayNumber = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

/**
 * 다음 추첨까지 남은 시간. nextDraw = 서버의 { round, date, drawAt }.
 * dday = 달력 기준 남은 날 (0이면 추첨 당일), days·hours·minutes·seconds = 남은 시간, over = 추첨 시각이 지남
 */
export function useCountdown(nextDraw) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!nextDraw) return null
  const left = Math.max(0, Date.parse(nextDraw.drawAt) - now)
  const s = Math.floor(left / 1000)
  return {
    dday: dayNumber(nextDraw.date) - dayNumber(todayKst(now)),
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    over: left === 0,
  }
}

export const pad2 = (n) => String(n).padStart(2, '0')
