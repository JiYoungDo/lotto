import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { generateNumbers, fetchGenerateOptions, saveTickets } from '../api.js'
import { ballRange } from '../ball.js'
import { CASE_GUIDE, sourceLabel } from '../hypotheses.js'
import Balls from './Balls.jsx'
import Disclaimer from './Disclaimer.jsx'

// 가설 선택 카드: 0 = 무작위, 1~9 = 가설
const PICKS = [
  { caseNo: 0, title: '무작위', desc: '조건 없이 1~45에서 6개', pips: ['', '', '', '', '', ''] },
  ...CASE_GUIDE.map((g, i) => ({ caseNo: i + 1, title: g.title, desc: g.desc, pips: g.pips })),
]
const pct = (v) => `${(v * 100).toFixed(2)}%`
const ALL_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1)

// 가설별로 번호판 위에 표시할 번호 종류 (직전 회차 번호가 가장 먼저: 가운데든 양끝이든 직전 회차 묶음)
function numberKind(n, opt) {
  if (!opt.usable.includes(n)) return 'unused'
  if (opt.caseNo === 0) return 'any'
  if (opt.prevNumbers.includes(n)) return 'prev'
  return opt.center.includes(n) ? 'center' : 'high'
}
const KIND_LABEL = {
  prev: '직전 회차 번호', center: '가운데 번호', high: '많은 양끝 번호', any: '번호', unused: '이 가설에서는 쓰지 않는 번호',
}

// 번호판: 이 가설의 조합에 들어갈 수 있는 번호를 보여 주고, 누르면 빼거나 되돌림
function NumberBoard({ opt, removed, onToggle, onReset }) {
  const usable = opt.usable.filter((n) => !removed.includes(n))
  const [needPrev, needCenter, needHigh] = opt.shape ?? [0, 0, 0]
  const left = (kind) => usable.filter((n) => numberKind(n, opt) === kind).length
  const need = [
    needPrev > 0 && `직전 회차 번호 ${left('prev')}개 중 ${needPrev}개`,
    needCenter > 0 && `가운데 번호 ${left('center')}개 중 ${needCenter}개`,
    needHigh > 0 && `많은 양끝 번호 ${left('high')}개 중 ${needHigh}개`,
  ].filter(Boolean)
  return (
    <div className="num-board">
      <div className="num-board-head">
        <div>
          <div className="title-md" style={{ fontSize: 16 }}>이 가설에 쓰는 번호 {usable.length}개</div>
          <p className="caption">빼고 싶은 번호를 누르면 그 번호가 든 조합은 만들지 않습니다. 다시 누르면 돌아옵니다.</p>
        </div>
        {removed.length > 0 && (
          <button className="btn btn-secondary btn-sm" type="button" onClick={onReset}>뺀 번호 {removed.length}개 모두 되돌리기</button>
        )}
      </div>
      <div className="num-board-grid">
        {ALL_NUMBERS.map((n) => {
          const kind = numberKind(n, opt)
          const off = removed.includes(n)
          const prev = opt.prevNumbers.includes(n)
          return (
            <button key={n} type="button" disabled={kind === 'unused'} aria-pressed={!off}
                    className={`ball r${ballRange(n)} board-ball ${kind}` + (off ? ' removed' : '') + (prev && kind !== 'unused' ? ' prev' : '')}
                    title={`${n}번 · ${KIND_LABEL[kind]}${prev && kind === 'any' ? ' · 직전 회차 번호' : ''}${kind === 'unused' ? '' : off ? ' · 눌러서 되돌리기' : ' · 눌러서 빼기'}`}
                    onClick={() => onToggle(n)}>
              {n}
            </button>
          )
        })}
      </div>
      <div className="case-legend board-legend" aria-hidden="true">
        {needCenter > 0 && <span><i className="board-key center" />가운데 번호</span>}
        {needHigh > 0 && <span><i className="board-key high" />많은 양끝 번호</span>}
        {(opt.caseNo === 0 || needPrev > 0) && <span><i className="board-key prev" />직전 회차 번호</span>}
        <span><i className="board-key removed" />뺀 번호</span>
        {opt.caseNo !== 0 && <span><i className="board-key unused" />이 가설에서 쓰지 않는 번호</span>}
      </div>
      <p className="caption board-summary">
        {removed.length > 0 && <>뺀 번호 <b className="num">{removed.join(', ')}</b> · </>}
        후보 {opt.candidates.toLocaleString()}개 조합 중 <b>{opt.remaining.toLocaleString()}개 남음</b>
        {need.length > 0 && ` · ${need.join(', ')}를 씁니다`}
      </p>
    </div>
  )
}

// 번호 만들기: 가설을 고르고 번호판에서 뺄 번호를 정해 번호를 뽑는다.
// guest 이면 가입 없이 뽑아 보기만 하고(저장 불가), 저장 자리에는 가입 안내가 나온다.
// slotsLeft 는 회원이 다음 회차에 남은 선점 슬롯 (불러오기 전이면 null). 그만큼만 만들 수 있고, 0이면 만들기가 막힌다.
// children 은 맨 아래에 붙는 내용 (마이페이지의 직접 입력)
export default function NumberMaker({ nextRound, onSaved, guest = false, slotsLeft = null, children }) {
  const [caseNo, setCaseNo] = useState(1)
  const [conf, setConf] = useState('60')
  const [count, setCount] = useState('5')
  const [gen, setGen] = useState(null)
  const [picked, setPicked] = useState([])
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [removed, setRemoved] = useState([]) // 번호판에서 뺀 번호
  const [opt, setOpt] = useState(null)       // 번호판 미리보기 (가설에 쓰는 번호, 후보 수)
  const [optError, setOptError] = useState(null)
  const round = nextRound ?? opt?.round ?? null
  const maxCount = guest ? 5 : Math.min(10, slotsLeft ?? 10)
  const noSlots = !guest && slotsLeft === 0
  // 남은 슬롯이 줄면 줄 수도 그만큼으로 맞춤
  const countShown = maxCount > 0 && Number(count) > maxCount ? String(maxCount) : count

  const confNum = Number(conf)
  const confOk = conf !== '' && confNum >= 1 && confNum <= 99
  useEffect(() => {
    if (!confOk) return
    let alive = true
    fetchGenerateOptions(caseNo, confNum, removed, guest)
      .then((o) => { if (alive) { setOpt(o); setOptError(null) } })
      .catch((e) => { if (alive) setOptError(e.message) })
    return () => { alive = false }
  }, [caseNo, confNum, confOk, removed, guest])

  const toggle = (n) => setRemoved((r) => (r.includes(n) ? r.filter((x) => x !== n) : [...r, n].sort((a, b) => a - b)))

  const make = async () => {
    setBusy(true)
    setError(null)
    try {
      const g = await generateNumbers(caseNo, Number(countShown), Number(conf), removed, guest)
      setGen(g)
      setPicked(g.sets.map(() => true))
    } catch (e) {
      setError(e.message)
      setGen(null)
    } finally {
      setBusy(false)
    }
  }

  const chosen = gen ? gen.sets.filter((_, i) => picked[i]) : []

  const save = async () => {
    if (chosen.length === 0) return
    setBusy(true)
    try {
      const r = await saveTickets({ round: gen.round, sets: chosen, caseNo: gen.caseNo, conf: gen.conf, memo })
      onSaved(r.message)
      setGen(null); setMemo('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section" id="make">
      <div className="container">
        <div className="section-head">
          <h2 className="display-sm">{round ? `${round}회` : '다음 회차'} 번호 만들기</h2>
          <p>
            가설을 고르면 지금까지의 당첨 번호로 계산한 가운데 번호를 기준으로, 그 가설의 조건을 만족하는 조합 중에서 무작위로 뽑습니다.
            {guest
              ? ' 가입 없이 바로 뽑아 볼 수 있어요. 마음에 드는 조합을 내 이름으로 저장(선점)하려면 가입이 필요합니다.'
              : ' 마음에 드는 줄만 골라 저장하세요.'}
            {' '}다른 회원이 이미 저장한 조합은 나오지 않고 저장할 수도 없습니다.
          </p>
        </div>
        <Disclaimer />

        <div className="pick-grid" role="radiogroup" aria-label="가설 선택">
          {PICKS.map((p) => (
            <button key={p.caseNo} type="button" role="radio" aria-checked={caseNo === p.caseNo}
                    className={'pick-card' + (caseNo === p.caseNo ? ' on' : '')} onClick={() => setCaseNo(p.caseNo)}>
              <span className="case-no">{p.caseNo === 0 ? '기본' : `가설 ${p.caseNo}`}</span>
              <span className="pick-title">{p.title}</span>
              <span className="pips" aria-hidden="true">
                {p.pips.map((c, j) => <i key={j} className={'pip ' + (c || 'r')} />)}
              </span>
              <span className="pick-desc">{p.desc}</span>
            </button>
          ))}
        </div>
        <div className="case-legend" aria-hidden="true">
          <span><i className="pip p" />직전 회차 번호</span>
          <span><i className="pip c" />가운데 번호 (직전 회차 제외)</span>
          <span><i className="pip h" />많은 양끝 번호 (직전 회차 제외)</span>
        </div>

        <div className="feature-card" style={{ marginTop: 24 }}>
          <div className="inline-form">
            <div className="field">
              <label className="field-label" htmlFor="g-conf">신뢰구간 (%)</label>
              <input className="input num" id="g-conf" type="number" min="1" max="99" value={conf}
                     disabled={caseNo === 0} onChange={(e) => setConf(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="g-count">줄 수</label>
              <input className="input num" id="g-count" type="number" min="1" max={Math.max(1, maxCount)} value={countShown}
                     disabled={noSlots} onChange={(e) => setCount(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="button" onClick={make} disabled={busy || noSlots}>{gen ? '다시 만들기' : '번호 만들기'}</button>
          </div>
          {!guest && slotsLeft != null && (
            noSlots ? (
              <p className="notice">
                {round ? `${round}회 ` : ''}선점 슬롯을 모두 썼어요. <a href="#rewards">출석 체크나 미니 게임 목표 점수</a>로 슬롯을 늘리면 더 만들 수 있어요.
              </p>
            ) : (
              <p className="caption" style={{ marginTop: 8 }}>남은 선점 슬롯 <b className="num">{slotsLeft}줄</b> · 한 번에 {maxCount}줄까지 만들 수 있어요.</p>
            )
          )}
          {error && <p className="notice">{error}</p>}
          {optError && <p className="notice">{optError}</p>}
          {opt && opt.caseNo === caseNo && <NumberBoard opt={opt} removed={removed} onToggle={toggle} onReset={() => setRemoved([])} />}

          {gen && (
            <div className="gen-result">
              <p className="caption">
                {gen.round}회 · {sourceLabel(gen.caseNo)}
                {gen.caseNo !== 0 && ` · 신뢰구간 ${gen.conf}% · 가운데 번호 ${gen.center.length}개`}
                {gen.removed?.length > 0 && ` · 뺀 번호 ${gen.removed.join(', ')}`}
                {' · '}후보 {gen.candidates.toLocaleString()}개 조합 중 <b>{gen.remaining.toLocaleString()}개 남음</b> (소진 {gen.used.toLocaleString()}개)
                {' · '}무작위로 나온 당첨 번호가 이 조건에 들어갈 확률 {pct(gen.probability)}
              </p>
              <div className="gen-list">
                {gen.sets.map((s, i) => (guest ? (
                  <div key={s.join('-')} className="gen-row on">
                    <span className="num muted">{String.fromCharCode(65 + i)}</span>
                    <span><Balls numbers={s} /></span>
                  </div>
                ) : (
                  <label key={s.join('-')} className={'gen-row' + (picked[i] ? ' on' : '')}>
                    <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked(picked.map((v, j) => (j === i ? e.target.checked : v)))} />
                    <span className="num muted">{String.fromCharCode(65 + i)}</span>
                    <span><Balls numbers={s} /></span>
                  </label>
                )))}
              </div>
              {guest ? (
                <div className="try-cta">
                  <p><b>이 조합이 마음에 드나요?</b> 가입하면 내 이름으로 저장(선점)할 수 있어요. 다른 회원이 먼저 저장하면 그 조합은 더 이상 나오지 않아요.</p>
                  <div className="inline-form">
                    <Link className="btn btn-primary" to="/signup">가입하고 저장하기</Link>
                    <Link className="btn btn-secondary" to="/login">이미 회원이에요</Link>
                  </div>
                </div>
              ) : (
                <div className="inline-form" style={{ marginTop: 16 }}>
                  <div className="field" style={{ flex: 1, minWidth: 200 }}>
                    <label className="field-label" htmlFor="g-memo">메모 (선택)</label>
                    <input className="input" id="g-memo" maxLength={50} placeholder="예: 동네 편의점, 자동" value={memo} onChange={(e) => setMemo(e.target.value)} />
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => setPicked(gen.sets.map(() => !picked.every(Boolean)))}>
                    {picked.every(Boolean) ? '모두 해제' : '모두 선택'}
                  </button>
                  <button className="btn btn-primary" type="button" onClick={save} disabled={busy || chosen.length === 0}>
                    선택한 {chosen.length}줄 저장
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {children}
      </div>
    </section>
  )
}

