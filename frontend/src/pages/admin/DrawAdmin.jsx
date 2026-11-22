import { useEffect, useRef, useState } from 'react'
import { fetchDraws, addDraw, deleteDraw, uploadExcel } from '../../api.js'
import { useAuth } from '../../auth.js'
import Balls from '../../components/Balls.jsx'
import { defaultDrawDate, formatDrawDate } from '../../drawDate.js'

const PAGE = 30
const EMPTY = ['', '', '', '', '', '']

// 관리자 · 회차 관리: 엑셀 업로드, 회차 추가·수정·삭제
export default function DrawAdmin({ username }) {
  const { refresh } = useAuth()
  const [limit, setLimit] = useState(PAGE)
  const [data, setData] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState('')
  const [nums, setNums] = useState(EMPTY)
  const [bonus, setBonus] = useState('')
  const [date, setDate] = useState('') // 추첨일 (비우면 회차로 계산한 날짜)
  const [editing, setEditing] = useState(null) // 수정 중인 회차
  const formRef = useRef(null)

  const load = (n = limit) => fetchDraws(n).then(setData).catch((e) => setMsg(e.message))
  useEffect(() => { load(limit) }, [limit]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (job) => {
    setMsg(null)
    setBusy(true)
    try {
      const r = await job()
      setMsg(r.message)
      await load()
      return true
    } catch (e) {
      setMsg(e.message)
      if (e.status === 401 || e.status === 403) await refresh() // 세션이 끝났으면 로그인 화면으로
      return false
    } finally {
      setBusy(false)
    }
  }

  const onUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await run(() => uploadExcel(file))
    e.target.value = ''
  }

  const resetForm = () => { setRound(''); setNums(EMPTY); setBonus(''); setDate(''); setEditing(null) }

  const onSave = async (e) => {
    e.preventDefault()
    const r = round === '' ? data?.nextRound : Number(round)
    if (!r) return
    const exists = !editing && data?.draws.some((d) => d.round === r)
    if (exists && !window.confirm(`${r}회가 이미 있습니다. 덮어쓸까요?`)) return
    if (await run(() => addDraw(r, nums.map(Number), Number(bonus), date || autoDate))) resetForm()
  }

  const onEdit = (d) => {
    setEditing(d.round)
    setRound(String(d.round))
    setNums(d.numbers.map(String))
    setBonus(d.bonus == null ? '' : String(d.bonus))
    setDate(d.date ?? '')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const onDelete = async (d) => {
    if (!window.confirm(`${d.round}회 (${d.numbers.join(', ')})를 삭제할까요? 되돌릴 수 없습니다.`)) return
    if (await run(() => deleteDraw(d.round)) && editing === d.round) resetForm()
  }

  const latest = data?.draws[0]
  const formRound = round === '' ? data?.nextRound : Number(round) // 입력란 기준 회차 (추첨일 기본값 계산용)
  const autoDate = formRound >= 1 ? (formRound === data?.nextRound && data?.nextDraw ? data.nextDraw.date : defaultDrawDate(formRound)) : ''

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">관리자 · {username}</span>
            <h1 className="display-mega">회차<br />관리</h1>
            <p className="lead">엑셀로 한꺼번에 올리거나 한 회차씩 추가·수정·삭제합니다. 저장한 번호는 모든 사용자에게 바로 보입니다.</p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="#input">회차 추가</a>
              <a className="btn btn-outline-dark btn-lg" href="#list">회차 목록</a>
            </div>
          </div>
          <div className="hero-cards">
            <div className="card-dark card-back">
              <div className="card-label">다음 입력 회차</div>
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 0 }}>{data ? `${data.nextRound}회` : '-'}</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">저장된 회차</div>
              <div className="card-stat">{data ? data.total.toLocaleString() : '-'}</div>
              <div className="card-row"><span>최신 회차</span><span className="num">{latest ? `${latest.round}회 · ${formatDrawDate(latest.date)}` : '-'}</span></div>
              <div className="card-row"><span>최신 당첨 번호</span><span className="num">{latest ? latest.numbers.join(' · ') + (latest.bonus != null ? ` + ${latest.bonus}` : '') : '-'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="input">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차 등록</h2>
            <p>엑셀은 B열 회차, C~H열 번호 6개, I열 보너스 번호 형식이며 첫 줄은 제목으로 건너뜁니다. 같은 회차를 다시 올리면 번호를 덮어쓰고, 추첨일은 그대로 둡니다. 새 회차의 추첨일은 1회부터 매주 토요일로 계산합니다.</p>
          </div>
          <div className="grid-2">
            <div className="feature-card">
              <div className="title-md">엑셀 업로드</div>
              <p className="caption">1회차부터 최신 회차까지 한 번에 올릴 수 있습니다.</p>
              <div style={{ marginTop: 24 }}>
                <input className="input" type="file" accept=".xlsx,.xls" onChange={onUpload} disabled={busy} />
              </div>
            </div>
            <div className="feature-card" ref={formRef}>
              <div className="title-md">{editing ? `${editing}회 수정` : '새 회차 추가'}</div>
              <p className="caption">
                {editing ? '번호를 고친 뒤 저장하세요.' : `당첨 번호 6개와 보너스 번호를 입력하세요. 회차를 비우면 ${data ? `${data.nextRound}회` : '다음 회차'}로 저장합니다.`}
              </p>
              <form onSubmit={onSave}>
                <div>
                  <label className="field-label" htmlFor="round">회차</label>
                  <input className="input num" id="round" type="number" min="1" placeholder={data ? String(data.nextRound) : ''}
                         value={round} disabled={!!editing} onChange={(e) => setRound(e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="draw-date">추첨일</label>
                  <input className="input num" id="draw-date" type="date" value={date || autoDate}
                         onChange={(e) => setDate(e.target.value)} />
                  <p className="caption" style={{ marginTop: 4 }}>
                    {date && date !== autoDate ? '직접 고친 날짜로 저장합니다.' : '1회(2002-12-07)부터 매주 토요일로 계산한 날짜입니다. 휴방 등으로 다르면 고쳐 주세요.'}
                  </p>
                </div>
                <div>
                  <label className="field-label">당첨 번호 + 보너스</label>
                  <div className="num-grid with-bonus">
                    {nums.map((v, i) => (
                      <input key={i} className="input" type="number" min="1" max="45" required value={v}
                             aria-label={`번호 ${i + 1}`}
                             onChange={(e) => setNums(nums.map((x, j) => (j === i ? e.target.value : x)))} />
                    ))}
                    <span className="plus" aria-hidden="true">+</span>
                    <input className="input" type="number" min="1" max="45" required value={bonus}
                           aria-label="보너스 번호" onChange={(e) => setBonus(e.target.value)} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy}>{editing ? '저장' : '추가'}</button>
                  {editing && <button className="btn btn-secondary" type="button" onClick={resetForm}>취소</button>}
                </div>
              </form>
            </div>
          </div>
          {msg && <p className="notice">{msg}</p>}
        </div>
      </section>

      <section className="section band-soft" id="list">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차 목록</h2>
            <p>{data ? `총 ${data.total.toLocaleString()}회 중 최근 ${data.draws.length.toLocaleString()}회입니다. 수정을 누르면 위 입력란에 번호가 채워집니다.` : '불러오는 중...'}</p>
          </div>
          {data && (
            <div className="feature-card">
              <div className="table-wrap">
                {data.draws.length === 0 ? (
                  <p className="empty">아직 등록된 회차가 없습니다. 엑셀을 업로드해 주세요.</p>
                ) : (
                  <table className="list-table">
                    <thead><tr><th>회차</th><th>추첨일</th><th>당첨 번호</th><th className="r">관리</th></tr></thead>
                    <tbody>
                      {data.draws.map((d) => (
                        <tr key={d.round} className={editing === d.round ? 'editing' : ''}>
                          <td className="num">{d.round}</td>
                          <td className="num muted" style={{ whiteSpace: 'nowrap' }}>{formatDrawDate(d.date)}</td>
                          <td><Balls numbers={d.numbers} bonus={d.bonus} />{d.bonus == null && <span className="caption"> 보너스 없음</span>}</td>
                          <td>
                            <div className="row-actions">
                              <button className="btn btn-secondary btn-sm" type="button" onClick={() => onEdit(d)} disabled={busy}>수정</button>
                              <button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(d)} disabled={busy}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {data.draws.length < data.total && (
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <button className="btn btn-secondary" type="button" onClick={() => setLimit(limit + PAGE)}>{PAGE}회 더 보기</button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
