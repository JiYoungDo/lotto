import { useRef, useState } from 'react'
import Balls from './Balls.jsx'
import { ballRange } from '../ball.js'

// 표준정규분포 누적확률 Φ(z) (Abramowitz–Stegun 근사, 오차 < 1.5e-7)
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}
const pdf = (z) => Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI)

const W = 960
const PAD = { l: 44, r: 16, t: 16, b: 36 }
const R = 10 // 번호 공 반지름
const RANGES = ['1~10', '11~20', '21~30', '31~40', '41~45']

/**
 * 번호별 출현 횟수를 표준화(z = (횟수 - 평균) / 표준편차)해서
 * 표준정규분포 곡선 위의 점, 번호별 막대, 표로 보여준다.
 */
export default function NormalChart({ counts, mean, sd, z: zc, draws }) {
  const [view, setView] = useState('curve')
  const [hover, setHover] = useState(null) // { n, x, y }
  const wrap = useRef(null)

  const items = counts.map((c, i) => {
    const n = i + 1
    const z = sd > 0 ? (c - mean) / sd : 0
    return { n, count: c, z, inside: Math.abs(z) <= zc }
  })
  const span = Math.max(3.5, Math.ceil((Math.max(...items.map((d) => Math.abs(d.z))) + 0.3) * 2) / 2)

  const show = (d, e) => {
    const box = wrap.current.getBoundingClientRect()
    setHover({ n: d.n, x: e.clientX - box.left, y: e.clientY - box.top })
  }
  const hide = () => setHover(null)
  const hd = hover && items[hover.n - 1]

  return (
    <div className="feature-card">
      <div className="dist-head">
        <div className="ball-legend">
          {RANGES.map((r, i) => (
            <span key={r}><i style={{ background: `var(--ball-${i + 1})` }} />{r}</span>
          ))}
        </div>
        <div className="seg" role="tablist">
          {[['curve', '정규분포 곡선'], ['bar', '번호별 z-점수'], ['table', '표']].map(([k, label]) => (
            <button key={k} type="button" className={view === k ? 'on' : ''} onClick={() => setView(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="dist-chart" ref={wrap} onMouseLeave={hide}>
        {view === 'curve' && <Curve items={items} span={span} zc={zc} hoverN={hover?.n} onHover={show} />}
        {view === 'bar' && <Bars items={items} span={span} zc={zc} hoverN={hover?.n} onHover={show} />}
        {view === 'table' && <DistTable items={items} />}
        {hd && view !== 'table' && (
          <div className="dist-tip" style={{ left: hover.x, top: hover.y }}>
            <b>{hd.n}번</b> · {hd.inside ? '가운데' : '양끝'}<br />
            출현 <b>{hd.count}</b>회 (평균 {mean.toFixed(1)})<br />
            z = <b>{hd.z.toFixed(2)}</b> · Φ(z) = <b>{(phi(hd.z) * 100).toFixed(1)}%</b>
          </div>
        )}
      </div>

      <p className="note">
        {draws.toLocaleString()}개 회차 기준 · 평균 {mean.toFixed(2)}회 · 표준편차 {sd.toFixed(2)}회 ·
        가운데 구간 |z| ≤ {zc.toFixed(3)} (파란 영역). z는 평균보다 표준편차 몇 배만큼 많이(+) 또는 적게(−) 나왔는지를 뜻합니다.
      </p>
    </div>
  )
}

// 표준정규분포 곡선 + 번호 공(z 위치에 쌓아서 표시)
function Curve({ items, span, zc, hoverN, onHover }) {
  // 겹치지 않게 z 순서대로 가장 낮은 층에 배치
  const plotW = W - PAD.l - PAD.r
  const sx = (z) => PAD.l + ((z + span) / (2 * span)) * plotW
  const placed = []
  for (const d of [...items].sort((a, b) => a.z - b.z)) {
    const x = sx(d.z)
    let level = 0
    while (placed.some((p) => p.level === level && Math.abs(p.x - x) < R * 2 + 1)) level++
    placed.push({ ...d, x, level })
  }
  const levels = Math.max(...placed.map((p) => p.level)) + 1
  const curveH = 220
  const H = PAD.t + Math.max(curveH, levels * (R * 2 + 2) + 40) + PAD.b
  const base = H - PAD.b
  const peak = pdf(0)
  const sy = (p) => base - (p / peak) * curveH

  const pts = []
  for (let i = 0; i <= 200; i++) {
    const z = -span + (i / 200) * 2 * span
    pts.push(`${sx(z).toFixed(1)},${sy(pdf(z)).toFixed(1)}`)
  }
  const band = [`${sx(-zc)},${base}`]
  for (let i = 0; i <= 60; i++) {
    const z = -zc + (i / 60) * 2 * zc
    band.push(`${sx(z).toFixed(1)},${sy(pdf(z)).toFixed(1)}`)
  }
  band.push(`${sx(zc)},${base}`)

  const ticks = []
  for (let t = -Math.floor(span); t <= Math.floor(span); t++) ticks.push(t)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="번호별 z-점수를 표준정규분포 곡선 위에 표시한 그래프">
      <polygon className="band" points={band.join(' ')} />
      <line className="edge" x1={sx(-zc)} x2={sx(-zc)} y1={base} y2={PAD.t} />
      <line className="edge" x1={sx(zc)} x2={sx(zc)} y1={base} y2={PAD.t} />
      <text className="lbl" x={sx(-zc) - 4} y={PAD.t + 10} textAnchor="end">−{zc.toFixed(2)}</text>
      <text className="lbl" x={sx(zc) + 4} y={PAD.t + 10}>+{zc.toFixed(2)}</text>
      <polyline className="curve" points={pts.join(' ')} />
      <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} />
      {ticks.map((t) => (
        <text key={t} className="tick" x={sx(t)} y={base + 20} textAnchor="middle">{t > 0 ? `+${t}` : t}</text>
      ))}
      <text className="lbl" x={W - PAD.r} y={base + 20} textAnchor="end">z</text>
      {placed.map((d) => {
        const cy = base - R - 2 - d.level * (R * 2 + 2)
        return (
          <g key={d.n} onMouseMove={(e) => onHover(d, e)}>
            <circle className={'dot' + (d.n === hoverN ? ' on' : '')} cx={d.x} cy={cy} r={R}
              style={{ fill: `var(--ball-${ballRange(d.n)})` }} />
            <text className="dot-text" x={d.x} y={cy + 3} textAnchor="middle">{d.n}</text>
          </g>
        )
      })}
    </svg>
  )
}

// 번호별 z-점수 막대 (0 기준 위/아래)
function Bars({ items, span, zc, hoverN, onHover }) {
  const H = 300
  const plotW = W - PAD.l - PAD.r
  const step = plotW / 45
  const bw = Math.max(4, step - 4)
  const sy = (z) => PAD.t + ((span - z) / (2 * span)) * (H - PAD.t - PAD.b)
  const zero = sy(0)
  const ticks = []
  for (let t = -Math.floor(span); t <= Math.floor(span); t++) ticks.push(t)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="번호 1~45의 z-점수 막대 그래프">
      <rect x={PAD.l} width={plotW} y={sy(zc)} height={sy(-zc) - sy(zc)} className="band" />
      {ticks.map((t) => (
        <g key={t}>
          <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} strokeOpacity={t === 0 ? 1 : 0.5} />
          <text className="tick" x={PAD.l - 8} y={sy(t) + 4} textAnchor="end">{t > 0 ? `+${t}` : t}</text>
        </g>
      ))}
      <line className="edge" x1={PAD.l} x2={W - PAD.r} y1={sy(zc)} y2={sy(zc)} />
      <line className="edge" x1={PAD.l} x2={W - PAD.r} y1={sy(-zc)} y2={sy(-zc)} />
      {items.map((d, i) => {
        const x = PAD.l + i * step + (step - bw) / 2
        const top = Math.min(sy(d.z), zero)
        const h = Math.max(1, Math.abs(sy(d.z) - zero))
        const rad = Math.min(4, bw / 2, h)
        // 0에서 먼 쪽 끝만 둥글게
        const path = d.z >= 0
          ? `M${x},${zero} V${top + rad} Q${x},${top} ${x + rad},${top} H${x + bw - rad} Q${x + bw},${top} ${x + bw},${top + rad} V${zero} Z`
          : `M${x},${zero} V${top + h - rad} Q${x},${top + h} ${x + rad},${top + h} H${x + bw - rad} Q${x + bw},${top + h} ${x + bw},${top + h - rad} V${zero} Z`
        return (
          <g key={d.n} onMouseMove={(e) => onHover(d, e)}>
            <rect x={PAD.l + i * step} width={step} y={PAD.t} height={H - PAD.t - PAD.b} fill="transparent" />
            <path className={'bar' + (d.inside ? '' : ' out') + (d.n === hoverN ? ' on' : '')} d={path} />
            {(d.n === 1 || d.n % 5 === 0) && (
              <text className="tick" x={x + bw / 2} y={H - PAD.b + 20} textAnchor="middle">{d.n}</text>
            )}
          </g>
        )
      })}
      <text className="lbl" x={W - PAD.r} y={H - 4} textAnchor="end">번호</text>
      <g className="lbl">
        <rect x={PAD.l + 4} y={H - 14} width={10} height={10} rx={2} fill="var(--primary)" />
        <text x={PAD.l + 20} y={H - 5}>가운데</text>
        <rect x={PAD.l + 70} y={H - 14} width={10} height={10} rx={2} fill="var(--muted-soft)" />
        <text x={PAD.l + 86} y={H - 5}>양끝</text>
      </g>
    </svg>
  )
}

function DistTable({ items }) {
  return (
    <div className="table-wrap">
      <table className="list-table">
        <thead>
          <tr>
            <th>번호</th><th className="r">출현 횟수</th><th className="r">z-점수</th>
            <th className="r">Φ(z) 누적확률</th><th className="r">상위</th><th>구간</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.n}>
              <td><Balls numbers={[d.n]} /></td>
              <td className="r num">{d.count}</td>
              <td className={'r num ' + (d.z > 0 ? 'up' : d.z < 0 ? 'down' : '')}>{d.z > 0 ? '+' : ''}{d.z.toFixed(3)}</td>
              <td className="r num">{(phi(d.z) * 100).toFixed(2)}%</td>
              <td className="r num muted">{((1 - phi(d.z)) * 100).toFixed(2)}%</td>
              <td className={d.inside ? 'hit' : 'muted'}>{d.inside ? '가운데' : '양끝'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
