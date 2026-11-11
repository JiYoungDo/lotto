// 공 여러 개 표시. dim(번호) 에 해당하면 흐리게.
export default function Balls({ numbers, dim }) {
  return numbers.map((n) => (
    <span key={n} className={'ball' + (dim && dim.includes(n) ? ' out' : '')}>{n}</span>
  ))
}
