import { ballRange } from '../ball.js'

// 로또 공 색: 1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록

// 공 여러 개 표시. dim(번호) 에 해당하면 흐리게.
export default function Balls({ numbers, dim }) {
  return numbers.map((n) => (
    <span key={n} className={`ball r${ballRange(n)}` + (dim && dim.includes(n) ? ' out' : '')}>{n}</span>
  ))
}
