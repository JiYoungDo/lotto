import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { generateNumbers, fetchMyTickets, saveTickets, updateTicketMemo, deleteTicket } from '../api.js'
import { useAuth } from '../auth.js'
import Balls from '../components/Balls.jsx'
import { CASE_GUIDE, sourceLabel, summaryLabel } from '../hypotheses.js'

// 가설 선택 카드: 0 = 무작위, 1~5 = 가설
const PICKS = [
  { caseNo: 0, title: '무작위', desc: '조건 없이 1~45에서 6개', pips: ['', '', '', '', '', ''] },
  ...CASE_GUIDE.map((g, i) => ({ caseNo: i + 1, title: g.title, desc: g.desc, pips: g.pips })),
]
const pct = (v) => `${(v * 100).toFixed(2)}%`

// 마이페이지: 가설로 다음 회차 번호를 만들고, 골라서 저장하고, 추첨 결과를 확인
export default function MyPage() {
  const { me, refresh } = useAuth()
  const [data, setData] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = () => fetchMyTickets().then(setData).catch(async (e) => {
    setMsg(e.message)
    if (e.status === 401) await refresh()
  })
  useEffect(() => { if (me?.loggedIn) load() }, [me?.loggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return null
  if (!me.loggedIn) return <Navigate to="/login" replace />

  const tickets = data?.tickets || []
  const pending = tickets.filter((t) => !t.drawn)
  const drawn = tickets.filter((t) => t.drawn)
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

      <Generator nextRound={data?.nextRound} onSaved={(m) => { setMsg(m); load() }} />

      <section className="section band-soft" id="mine">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">추첨 전 내 번호</h2>
            <p>아직 당첨 번호가 등록되지 않은 회차의 번호입니다. 메모에 구매처나 자동·수동 여부를 적어 둘 수 있습니다.</p>
          </div>
          {msg && <p className="notice" style={{ marginTop: 0, marginBottom: 16 }}>{msg}</p>}
          <div className="feature-card">
            {!data ? <p className="empty">불러오는 중…</p> : pending.length === 0 ? (
              <p className="empty">저장한 번호가 없습니다. 위에서 번호를 만들어 저장해 보세요.</p>
            ) : (
              <TicketTable rows={pending} onMemo={onMemo} onDelete={onDelete} />
            )}
          </div>
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

          {!data ? null : drawn.length === 0 ? (
            <div className="feature-card"><p className="empty">아직 추첨된 회차의 번호가 없습니다.</p></div>
          ) : (
            <ResultGroups rows={drawn} onMemo={onMemo} onDelete={onDelete} />
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

  const make = async () => {
    setBusy(true)
    setError(null)
    try {
      const g = await generateNumbers(caseNo, Number(count), Number(conf))
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

          {gen && (
            <div className="gen-result">
              <p className="caption">
                {gen.round}회 · {sourceLabel(gen.caseNo)}
                {gen.caseNo !== 0 && ` · 신뢰구간 ${gen.conf}% · 가운데 번호 ${gen.center.length}개`}
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

function TicketTable({ rows, onMemo, onDelete }) {
  return (
    <div className="table-wrap">
      <table className="list-table">
        <thead><tr><th>회차</th><th>번호</th><th>출처</th><th>메모</th><th className="r">관리</th></tr></thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="num">{t.round}</td>
              <td><Balls numbers={t.numbers} /></td>
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

function ResultGroups({ rows, onMemo, onDelete }) {
  const rounds = [...new Set(rows.map((t) => t.round))]
  return (
    <div className="result-groups">
      {rounds.map((r) => {
        const list = rows.filter((t) => t.round === r)
        const top = Math.max(...list.map((t) => t.matchCount))
        return (
          <div key={r} className="feature-card">
            <div className="result-head">
              <div className="title-md">{r}회</div>
              <div className="result-win"><span className="caption">당첨 번호</span><Balls numbers={list[0].winning} /></div>
              <span className="caption" style={{ marginLeft: 'auto' }}>{list.length}줄 · 최고 {top}개 일치</span>
            </div>
            <div className="table-wrap">
              <table className="list-table">
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id}>
                      <td><Balls numbers={t.numbers} dim={t.numbers.filter((n) => !t.matched.includes(n))} /></td>
                      <td className="num">{t.matchCount}개</td>
                      <td><span className={'role-badge' + (t.matchCount >= 3 ? ' admin' : '')}>{t.rank}</span></td>
                      <td><span className="caption">{sourceLabel(t.caseNo)}{t.memo ? ` · ${t.memo}` : ''}</span></td>
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
          </div>
        )
      })}
    </div>
  )
}
