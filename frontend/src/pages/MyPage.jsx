import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { generateNumbers, fetchGenerateOptions, fetchMyTickets, saveTickets, updateTicketMemo, deleteTicket } from '../api.js'
import { ballRange } from '../ball.js'
import { useAuth } from '../auth.js'
import Balls from '../components/Balls.jsx'
import { CASE_GUIDE, sourceLabel, summaryLabel } from '../hypotheses.js'
import { useDrawEvents } from '../drawEvents.js'
import { useChatEvents } from '../chat.js'
import { fetchMyChat, sendMyChat, readMyChat } from '../api.js'
import ChatThread from '../components/ChatThread.jsx'
import NotifyToggle from '../components/NotifyToggle.jsx'
import { useNotify } from '../notify.js'
import Disclaimer from '../components/Disclaimer.jsx'

// 가설 선택 카드: 0 = 무작위, 1~5 = 가설
const PICKS = [
  { caseNo: 0, title: '무작위', desc: '조건 없이 1~45에서 6개', pips: ['', '', '', '', '', ''] },
  ...CASE_GUIDE.map((g, i) => ({ caseNo: i + 1, title: g.title, desc: g.desc, pips: g.pips })),
]
const pct = (v) => `${(v * 100).toFixed(2)}%`
const ALL_NUMBERS = Array.from({ length: 45 }, (_, i) => i + 1)

// 가설별로 번호판 위에 표시할 번호 종류
function numberKind(n, opt) {
  if (!opt.usable.includes(n)) return 'unused'
  if (opt.caseNo === 0) return 'any'
  return opt.center.includes(n) ? 'center' : 'edge'
}
const KIND_LABEL = { center: '가운데 번호', edge: '양끝 번호', any: '번호', unused: '이 가설에서는 쓰지 않는 번호' }

// 번호판: 이 가설의 조합에 들어갈 수 있는 번호를 보여 주고, 누르면 빼거나 되돌림
function NumberBoard({ opt, removed, onToggle, onReset }) {
  const usable = opt.usable.filter((n) => !removed.includes(n))
  const prevCenter = opt.caseNo === 3 ? opt.prevNumbers.filter((n) => opt.center.includes(n) && !removed.includes(n)) : []
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
                    title={`${n}번 · ${KIND_LABEL[kind]}${prev ? ' · 직전 회차 번호' : ''}${kind === 'unused' ? '' : off ? ' · 눌러서 되돌리기' : ' · 눌러서 빼기'}`}
                    onClick={() => onToggle(n)}>
              {n}
            </button>
          )
        })}
      </div>
      <div className="case-legend board-legend" aria-hidden="true">
        {opt.caseNo !== 0 && <span><i className="board-key center" />가운데 번호</span>}
        {(opt.caseNo === 4 || opt.caseNo === 5) && <span><i className="board-key edge" />양끝 번호</span>}
        <span><i className="board-key prev" />직전 회차 번호</span>
        <span><i className="board-key removed" />뺀 번호</span>
        {opt.caseNo !== 0 && opt.caseNo < 4 && <span><i className="board-key unused" />이 가설에서 쓰지 않는 번호</span>}
      </div>
      <p className="caption board-summary">
        {removed.length > 0 && <>뺀 번호 <b className="num">{removed.join(', ')}</b> · </>}
        후보 {opt.candidates.toLocaleString()}개 조합 중 <b>{opt.remaining.toLocaleString()}개 남음</b>
        {opt.caseNo === 3 && ` · 직전 회차 가운데 번호 ${prevCenter.length}개 중 1개를 꼭 씁니다`}
      </p>
    </div>
  )
}

// 마이페이지: 가설로 다음 회차 번호를 만들고, 골라서 저장하고, 추첨 결과를 확인
export default function MyPage() {
  const { me, refresh } = useAuth()
  const [data, setData] = useState(null)
  const [msg, setMsg] = useState(null)
  const [openRounds, setOpenRounds] = useState(null) // 사용자가 직접 펼친 회차들 (null이면 기본값)

  const load = () => fetchMyTickets().then(setData).catch(async (e) => {
    setMsg(e.message)
    if (e.status === 401) await refresh()
  })
  useEffect(() => { if (me?.loggedIn) load() }, [me?.loggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // 관리자가 당첨 번호를 등록하면 새로고침 없이 결과를 다시 불러옴
  useDrawEvents((e) => {
    if (!me?.loggedIn) return
    load()
    if (e.action === 'saved' && e.round) setMsg(`${e.round}회 당첨 번호가 등록됐어요. 내 번호 결과를 확인하세요.`)
  })

  if (!me) return null
  if (!me.loggedIn) return <Navigate to="/login" replace />

  const tickets = data?.tickets || []
  const pending = tickets.filter((t) => !t.drawn)
  const drawn = tickets.filter((t) => t.drawn)
  // 위쪽 "내 번호": 추첨 전 번호 + 가장 최근에 추첨된 회차 번호 (결과가 바로 옆에 나옴)
  const latestDrawn = data ? data.nextRound - 1 : 0
  const current = tickets.filter((t) => !t.drawn || t.round === latestDrawn)
  const past = drawn.filter((t) => t.round !== latestDrawn)
  const currentRounds = [...new Set(current.map((t) => t.round))]
  const pastRounds = [...new Set(past.map((t) => t.round))]
  const opened = openRounds ?? new Set(currentRounds)
  const toggle = (r) => {
    const next = new Set(opened)
    if (next.has(r)) next.delete(r); else next.add(r)
    setOpenRounds(next)
  }
  const setAll = (rounds, open) => {
    const next = new Set(opened)
    for (const r of rounds) { if (open) next.add(r); else next.delete(r) }
    setOpenRounds(next)
  }
  const thisRound = pending.filter((t) => t.round === data?.nextRound).length
  const best = drawn.reduce((b, t) => Math.max(b, t.matchCount), -1)

  const onMemo = async (t) => {
    const memo = window.prompt('메모 (50자까지, 비우면 삭제)', t.memo || '')
    if (memo === null) return
    try { await updateTicketMemo(t.id, memo); await load() } catch (e) { setMsg(e.message) }
  }
  const onDelete = async (t) => {
    if (!window.confirm(`${t.round}회 ${t.numbers.join(', ')} 번호를 지울까요?`)) return
    try { await deleteTicket(t.id); await load() } catch (e) { setMsg(e.message) }
  }

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">마이페이지 · {me.username}</span>
            <h1 className="display-mega">내 번호<br />관리</h1>
            <p className="lead">가설을 골라 다음 회차 번호를 만들고, 실제로 산 번호를 저장해 두세요. 관리자가 당첨 번호를 등록하면 결과가 자동으로 나옵니다.</p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="#make">번호 만들기</a>
              <a className="btn btn-outline-dark btn-lg" href="#results">지난 결과</a>
            </div>
          </div>
          <div className="hero-cards">
            <div className="card-dark card-back">
              <div className="card-label">다음 회차</div>
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 0 }}>{data ? `${data.nextRound}회` : '-'}</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">{data ? `${data.nextRound}회` : '이번 회차'} 저장한 번호</div>
              <div className="card-stat">{data ? thisRound : '-'}<span style={{ fontSize: 24 }}> 줄</span></div>
              <div className="card-row"><span>전체 저장</span><span className="num">{data ? `${tickets.length}줄` : '-'}</span></div>
              <div className="card-row"><span>최고 결과</span><span className="num">{best >= 0 ? `${best}개 일치` : '-'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <MemberChat />

      <Generator nextRound={data?.nextRound} onSaved={(m) => { setMsg(m); load() }} />

      <section className="section band-soft" id="mine">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">이번 회차 내 번호</h2>
            <p>추첨 전 번호와 가장 최근 추첨 회차의 번호입니다. 관리자가 당첨 번호를 등록하면 새로고침하지 않아도 결과(낙첨, 몇 등)가 바로 표시됩니다.</p>
          </div>
          {msg && <p className="notice" style={{ marginTop: 0, marginBottom: 16 }}>{msg}</p>}
          {!data ? (
            <div className="feature-card"><p className="empty">불러오는 중…</p></div>
          ) : current.length === 0 ? (
            <div className="feature-card"><p className="empty">저장한 번호가 없습니다. 위에서 번호를 만들어 저장해 보세요.</p></div>
          ) : (
            <RoundFolds rounds={currentRounds} rows={current} opened={opened} onToggle={toggle} onSetAll={setAll}
                        onMemo={onMemo} onDelete={onDelete} />
          )}
        </div>
      </section>

      <section className="section" id="results">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">지난 결과</h2>
            <p>당첨 번호와 맞은 번호는 진하게, 틀린 번호는 흐리게 보입니다. 보너스 번호는 저장하지 않아 5개 일치는 2등과 3등을 구분하지 않습니다.</p>
          </div>

          {data && data.summary.length > 0 && (
            <div className="feature-card" style={{ marginBottom: 24 }}>
              <div className="title-md">출처별 내 성적</div>
              <div className="table-wrap">
                <table className="list-table">
                  <thead><tr><th>출처</th><th className="r">추첨된 줄</th><th className="r">평균 맞은 개수</th><th className="r">3개 이상 (5등 이상)</th><th className="r">최고</th></tr></thead>
                  <tbody>
                    {data.summary.map((s) => (
                      <tr key={s.key}>
                        <td className="title-md" style={{ fontSize: 15 }}>{summaryLabel(s.key)}</td>
                        <td className="r num">{s.tickets}</td>
                        <td className="r num">{s.avgMatch.toFixed(2)}</td>
                        <td className="r num">{s.wins}</td>
                        <td className="r num">{s.best}개</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="caption" style={{ marginTop: 12 }}>참고로 무작위로 산 한 줄의 평균 맞은 개수는 0.80개, 3개 이상 맞을 확률은 약 2.38%입니다.</p>
            </div>
          )}

          {!data ? null : past.length === 0 ? (
            <div className="feature-card"><p className="empty">{drawn.length > 0 ? '최근 회차 결과는 위에 있습니다. 그보다 지난 회차 번호는 아직 없습니다.' : '아직 추첨된 회차의 번호가 없습니다.'}</p></div>
          ) : (
            <RoundFolds rounds={pastRounds} rows={past} opened={opened} onToggle={toggle} onSetAll={setAll}
                        onMemo={onMemo} onDelete={onDelete} />
          )}

          <div className="setting-help">
            <div>
              <h3>안내</h3>
              <p>가설로 만든 번호도 당첨 확률은 무작위와 같습니다. 어느 6개 조합이든 1등 확률은 8,145,060분의 1입니다. 기록과 재미를 위한 기능입니다.</p>
            </div>
            <div>
              <h3>실제 구매</h3>
              <p>여기서는 번호만 기록하며 구매는 되지 않습니다. 복권은 공식 판매처에서 만 19세 이상만 살 수 있습니다. <Link to="/account">비밀번호 변경</Link></p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

// ---------- 번호 만들기 ----------

function Generator({ nextRound, onSaved }) {
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

  const confNum = Number(conf)
  const confOk = conf !== '' && confNum >= 1 && confNum <= 99
  useEffect(() => {
    if (!confOk) return
    let alive = true
    fetchGenerateOptions(caseNo, confNum, removed)
      .then((o) => { if (alive) { setOpt(o); setOptError(null) } })
      .catch((e) => { if (alive) setOptError(e.message) })
    return () => { alive = false }
  }, [caseNo, confNum, confOk, removed])

  const toggle = (n) => setRemoved((r) => (r.includes(n) ? r.filter((x) => x !== n) : [...r, n].sort((a, b) => a - b)))

  const make = async () => {
    setBusy(true)
    setError(null)
    try {
      const g = await generateNumbers(caseNo, Number(count), Number(conf), removed)
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
          <h2 className="display-sm">{nextRound ? `${nextRound}회` : '다음 회차'} 번호 만들기</h2>
          <p>가설을 고르면 지금까지의 당첨 번호로 계산한 가운데 번호를 기준으로, 그 가설의 조건을 만족하는 조합 중에서 무작위로 뽑습니다. 마음에 드는 줄만 골라 저장하세요. 다른 회원이 이미 저장한 조합은 나오지 않고 저장할 수도 없습니다.</p>
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

        <div className="feature-card" style={{ marginTop: 24 }}>
          <div className="inline-form">
            <div className="field">
              <label className="field-label" htmlFor="g-conf">신뢰구간 (%)</label>
              <input className="input num" id="g-conf" type="number" min="1" max="99" value={conf}
                     disabled={caseNo === 0} onChange={(e) => setConf(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="g-count">줄 수</label>
              <input className="input num" id="g-count" type="number" min="1" max="10" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="button" onClick={make} disabled={busy}>{gen ? '다시 만들기' : '번호 만들기'}</button>
          </div>
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
                {gen.sets.map((s, i) => (
                  <label key={s.join('-')} className={'gen-row' + (picked[i] ? ' on' : '')}>
                    <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked(picked.map((v, j) => (j === i ? e.target.checked : v)))} />
                    <span className="num muted">{String.fromCharCode(65 + i)}</span>
                    <span><Balls numbers={s} /></span>
                  </label>
                ))}
              </div>
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
            </div>
          )}
        </div>

        <ManualEntry nextRound={nextRound} onSaved={onSaved} />
      </div>
    </section>
  )
}

// 이미 산 번호를 직접 입력
function ManualEntry({ nextRound, onSaved }) {
  const [round, setRound] = useState('')
  const [nums, setNums] = useState(['', '', '', '', '', ''])
  const [memo, setMemo] = useState('')
  const [error, setError] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const r = await saveTickets({ round: round === '' ? nextRound : Number(round), sets: [nums.map(Number)], caseNo: null, memo })
      onSaved(r.message)
      setNums(['', '', '', '', '', '']); setMemo(''); setRound('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="feature-card" style={{ marginTop: 24 }}>
      <div className="title-md">직접 입력</div>
      <p className="caption">이미 산 번호를 그대로 기록합니다. 회차를 비우면 {nextRound ? `${nextRound}회` : '다음 회차'}로 저장합니다.</p>
      <form onSubmit={onSubmit}>
        <div className="manual-grid">
          <div>
            <label className="field-label" htmlFor="m-round">회차</label>
            <input className="input num" id="m-round" type="number" min="1" placeholder={nextRound ? String(nextRound) : ''} value={round} onChange={(e) => setRound(e.target.value)} />
          </div>
          <div>
            <label className="field-label">번호 6개</label>
            <div className="num-grid">
              {nums.map((v, i) => (
                <input key={i} className="input" type="number" min="1" max="45" required value={v} aria-label={`번호 ${i + 1}`}
                       onChange={(e) => setNums(nums.map((x, j) => (j === i ? e.target.value : x)))} />
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="m-memo">메모</label>
            <input className="input" id="m-memo" maxLength={50} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
        <div><button className="btn btn-primary" type="submit">저장</button></div>
      </form>
      {error && <p className="notice">{error}</p>}
    </div>
  )
}

// ---------- 목록 ----------

// 한 회차 결과 요약: 추첨 전 / 모두 낙첨 / 4등 1줄 · 낙첨 4줄
function RoundStatus({ list }) {
  if (!list[0].drawn) return <span className="result-chip pending">추첨 전</span>
  const counts = {}
  for (const t of list) counts[t.rank] = (counts[t.rank] || 0) + 1
  const wins = list.filter((t) => t.matchCount >= 3).length
  const order = ['1등', '5개 일치 (2·3등)', '4등', '5등', '낙첨']
  const text = order.filter((k) => counts[k]).map((k) => `${k} ${counts[k]}줄`).join(' · ')
  return <span className={'result-chip ' + (wins > 0 ? 'win' : 'lose')}>{wins === 0 ? `모두 낙첨 (${list.length}줄)` : text}</span>
}

function ResultBadge({ t }) {
  if (!t.drawn) return <span className="result-chip pending">추첨 전</span>
  return (
    <span className={'result-chip ' + (t.matchCount >= 3 ? 'win' : 'lose')}>
      {t.matchCount >= 3 ? `${t.rank} 당첨` : '낙첨'} · {t.matchCount}개 일치
    </span>
  )
}

function TicketTable({ rows, onMemo, onDelete }) {
  return (
    <div className="table-wrap">
      <table className="list-table">
        <thead><tr><th>번호</th><th>결과</th><th>출처</th><th>메모</th><th className="r">관리</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={t.drawn && t.matchCount >= 3 ? 'row-win' : ''}>
              <td><Balls numbers={t.numbers} dim={t.drawn ? t.numbers.filter((n) => !t.matched.includes(n)) : undefined} /></td>
              <td><ResultBadge t={t} /></td>
              <td><span className="role-badge">{sourceLabel(t.caseNo)}</span></td>
              <td className="muted">{t.memo || '-'}</td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => onMemo(t)}>메모</button>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(t)}>삭제</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 회차별로 접었다 폈다 하는 그룹. 접혀 있어도 제목 줄에 결과 요약이 보임.
function RoundFolds({ rounds, rows, opened, onToggle, onSetAll, onMemo, onDelete }) {
  const allOpen = rounds.every((r) => opened.has(r))
  return (
    <div className="result-groups">
      {rounds.length > 1 && (
        <div className="fold-tools">
          <span className="caption">{rounds.length}개 회차</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSetAll(rounds, !allOpen)}>
            {allOpen ? '모두 접기' : '모두 펼치기'}
          </button>
        </div>
      )}
      {rounds.map((r) => {
        const list = rows.filter((t) => t.round === r)
        const open = opened.has(r)
        const top = list[0].drawn ? Math.max(...list.map((t) => t.matchCount)) : null
        const bodyId = `round-${r}`
        return (
          <div key={r} className={'feature-card fold' + (open ? ' open' : '')}>
            <button type="button" className="fold-head" aria-expanded={open} aria-controls={bodyId} onClick={() => onToggle(r)}>
              <span className="fold-arrow" aria-hidden="true">▸</span>
              <span className="title-md">{r}회</span>
              <RoundStatus list={list} />
              <span className="caption fold-meta">{list.length}줄{top != null ? ` · 최고 ${top}개 일치` : ''}</span>
            </button>
            {open && (
              <div className="fold-body" id={bodyId}>
                {list[0].drawn && (
                  <div className="result-win" style={{ marginBottom: 8 }}>
                    <span className="caption">당첨 번호</span><Balls numbers={list[0].winning} />
                  </div>
                )}
                <TicketTable rows={list} onMemo={onMemo} onDelete={onDelete} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- 당첨 회원 ↔ 관리자 채팅 ----------

function MemberChat() {
  const [chat, setChat] = useState(null)
  const { refreshUnread, setViewing } = useNotify()
  const location = useLocation()

  const markRead = () => readMyChat().then(refreshUnread).catch(() => {})
  const load = () => fetchMyChat().then((c) => {
    setChat(c)
    if (c.eligible && c.unread > 0) markRead() // 화면에 보였으니 읽음 처리
  }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 불러옴
  useEffect(() => { load() }, [])

  // 이 화면에 있는 동안은 관리자 메시지 팝업 대신 바로 대화창에 표시
  useEffect(() => {
    if (!chat?.eligible) return undefined
    setViewing('me')
    return () => setViewing(null)
  }, [chat?.eligible, setViewing])

  // 알림을 눌러 /mypage#chat 으로 오면 채팅으로 스크롤
  useEffect(() => {
    if (chat?.eligible && location.hash === '#chat') {
      document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [chat?.eligible, location.hash, location.key])

  // 당첨 번호가 등록되면 채팅 자격이 새로 생길 수 있음
  useDrawEvents(() => load())

  // 관리자 메시지 실시간 수신
  useChatEvents(!!chat?.eligible, (m) => {
    if (!m) { load(); return }
    setChat((c) => (c && !c.messages.some((x) => x.id === m.id) ? { ...c, messages: [...c.messages, m] } : c))
    if (m.fromAdmin) markRead()
  })

  if (!chat?.eligible) return null

  const send = async (content) => {
    const m = await sendMyChat(content)
    setChat((c) => (c && !c.messages.some((x) => x.id === m.id) ? { ...c, messages: [...c.messages, m] } : c))
  }

  return (
    <section className="section band-soft" id="chat">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="win-banner">
          <strong>당첨을 축하드려요!</strong>
          <span>{chat.wins.map((w) => `${w.round}회 ${w.rank}`).join(' · ')}</span>
        </div>
        <div className="section-head" style={{ marginBottom: 20 }}>
          <h2 className="display-sm">관리자와 채팅</h2>
          <NotifyToggle />
          <p>당첨 기록이 있는 회원만 관리자와 1:1로 대화할 수 있습니다. 메시지는 실시간으로 주고받으며, 다른 회원에게는 보이지 않습니다. 비밀번호나 계좌번호 같은 민감한 정보는 보내지 마세요.</p>
        </div>
        <ChatThread messages={chat.messages} viewerIsAdmin={false} onSend={send} maxLength={chat.maxLength}
                    emptyText="아직 대화가 없습니다. 궁금한 점을 관리자에게 남겨 보세요." />
      </div>
    </section>
  )
}
