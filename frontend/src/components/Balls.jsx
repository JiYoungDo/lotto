import { ballRange } from '../ball.js'

// 로또 공 색: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록

// 공 여러 개 표시. dim(번호) 에 해당하면 흐리게. bonus 가 있으면 "+" 뒤에 보너스 공을 붙임.
export default function Balls({ numbers, dim, bonus }) {
  const ball = (n, key) => (
    <span key={key} className={`ball r${ballRange(n)}` + (dim && dim.includes(n) ? ' out' : '')}>{n}</span>
  )
  return (
    <>
      {numbers.map((n) => ball(n, n))}
      {bonus != null && <span className="ball-plus" aria-label="보너스">+</span>}
      {bonus != null && ball(bonus, 'bonus')}
    </>
  )
}
