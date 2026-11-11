import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDraws, addDraw, uploadExcel } from '../api.js'
import Balls from '../components/Balls.jsx'

export default function Draws() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [round, setRound] = useState('')
  const [nums, setNums] = useState(['', '', '', '', '', ''])

  const load = () => fetchDraws(50).then(setData).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  const run = async (job) => {
    setMsg(null)
    try {
      const r = await job()
      setMsg(r.message)
      setError(null)
      await load()
      return true
    } catch (e) {
      setMsg(e.message)
      return false
    }
  }

  const onUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    await run(() => uploadExcel(file))
    e.target.value = ''
  }

  const onAdd = async (e) => {
    e.preventDefault()
    const r = round === '' ? data.nextRound : Number(round)
    const ok = await run(() => addDraw(r, nums.map(Number)))
    if (ok) { setRound(''); setNums(['', '', '', '', '', '']) }
  }

  return (
    <>
      <section className="hero-dark">
        <div className="container hero-grid">
          <div>
            <span className="badge badge-dark">회차 데이터</span>
            <h1 className="display-mega">내 가설을<br />숫자로 확인하세요</h1>
            <p className="lead">엑셀로 지난 회차를 올리고, 새 회차는 한 줄씩 추가하세요. 쌓인 데이터로 가설이 맞았는지 바로 분석합니다.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/analysis">가설 분석 보기</Link>
              <a className="btn btn-outline-dark btn-lg" href="#input">데이터 입력</a>
            </div>
            {msg && <p className="notice">{msg}</p>}
          </div>
          <div className="hero-cards">
            <div className="card-dark card-back">
              <div className="card-label">다음 회차</div>
              <div className="card-stat" style={{ fontSize: 32, marginBottom: 0 }}>{data ? `${data.nextRound}회` : '-'}</div>
            </div>
            <div className="card-dark card-main">
              <div className="card-label">저장된 회차</div>
              <div className="card-stat">{data ? data.total.toLocaleString() : '-'}</div>
              <div className="card-row"><span>다음 입력 회차</span><span className="num">{data ? data.nextRound : '-'}</span></div>
              <div className="card-row"><span>목록 표시</span><span className="num">최근 50회</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="input">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">데이터 입력</h2>
            <p>엑셀은 B열 회차, C~H열 번호 6개 형식입니다. 같은 회차를 다시 올리면 덮어씁니다.</p>
          </div>
          <div className="grid-2">
            <div className="feature-card">
              <div className="title-md">엑셀 업로드</div>
              <p className="caption">1회차부터 최신 회차까지 한 번에 올릴 수 있습니다.</p>
              <div style={{ marginTop: 24 }}>
                <input className="input" type="file" accept=".xlsx" onChange={onUpload} />
              </div>
            </div>
            <div className="feature-card">
              <div className="title-md">새 회차 추가</div>
              <p className="caption">추첨 후 당첨 번호 6개를 입력하세요.</p>
              <form onSubmit={onAdd}>
                <div>
                  <label className="field-label" htmlFor="round">회차</label>
                  <input className="input num" id="round" type="number" placeholder={data ? String(data.nextRound) : ''}
                         value={round} onChange={(e) => setRound(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">당첨 번호</label>
                  <div className="num-grid">
                    {nums.map((v, i) => (
                      <input key={i} className="input" type="number" min="1" max="45" required value={v}
                             onChange={(e) => setNums(nums.map((x, j) => (j === i ? e.target.value : x)))} />
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">추가</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="section band-soft">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">최근 회차</h2>
            <p>{data ? `총 ${data.total}회 중 최근 ${data.draws.length}회입니다.` : '불러오는 중...'}</p>
          </div>
          {error && <p className="notice">서버에 연결하지 못했어요: {error}</p>}
          {data && (
            <div className="feature-card">
              <div className="table-wrap">
                {data.draws.length === 0 ? (
                  <p className="empty">아직 저장된 회차가 없습니다. 엑셀을 업로드해 주세요.</p>
                ) : (
                  <table className="list-table">
                    <thead><tr><th>회차</th><th>당첨 번호</th></tr></thead>
                    <tbody>
                      {data.draws.map((d) => (
                        <tr key={d.round}>
                          <td className="num">{d.round}</td>
                          <td><Balls numbers={d.numbers} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
