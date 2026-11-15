import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clearPosts, deletePost } from '../../api.js'
import { useCommunity, formatTime } from '../../community.js'

// 관리자 · 커뮤니티 관리: 현황, 글 개별 삭제, 전체 삭제
export default function CommunityAdmin() {
  const { posts, meta, online, connected, removeLocal } = useCommunity()
  const [msg, setMsg] = useState(null)
  const [q, setQ] = useState('')

  const onDelete = async (p) => {
    if (!window.confirm(`${p.nickname}님의 글을 지울까요?\n\n${p.win ? `[당첨 인증 ${p.win.round}회 ${p.win.rank}] ` : ''}${p.content.slice(0, 80)}`)) return
    try { await deletePost(p.id); removeLocal(p.id); setMsg('글을 지웠습니다.') } catch (e) { setMsg(e.message) }
  }
  const onClear = async () => {
    if (!window.confirm('커뮤니티 글을 모두 지울까요? 되돌릴 수 없습니다.')) return
    try { const r = await clearPosts(); setMsg(r.message) } catch (e) { setMsg(e.message) }
  }

  const shown = (posts || []).slice().reverse()
    .filter((p) => !q || p.nickname.toLowerCase().includes(q.toLowerCase()) || p.content.toLowerCase().includes(q.toLowerCase()))
  const authors = new Set((posts || []).map((p) => p.nickname)).size

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="display-sm">커뮤니티 관리</h2>
          <p>최신 {meta.max}개 글만 저장됩니다. 여기와 <Link to="/community">커뮤니티 화면</Link> 모두에서 아무 글이나 지울 수 있습니다. 목록은 실시간으로 바뀝니다.</p>
        </div>

        <div className="stat-grid">
          <div className="stat-tile"><div className="caption">저장된 글</div><div className="stat-value">{posts ? `${posts.length} / ${meta.max}` : '-'}</div></div>
          <div className="stat-tile"><div className="caption">글쓴이</div><div className="stat-value">{posts ? authors : '-'}</div></div>
          <div className="stat-tile accent"><div className="caption">지금 보는 사람</div><div className="stat-value">{connected ? online : '-'}</div></div>
        </div>

        <div className="feature-card" style={{ marginTop: 24 }}>
          <div className="toolbar">
            <input className="input" type="search" placeholder="글쓴이·내용 검색" value={q} onChange={(e) => setQ(e.target.value)}
                   style={{ maxWidth: 260 }} aria-label="글 검색" />
            <button className="btn btn-danger btn-sm" type="button" onClick={onClear} disabled={!posts || posts.length === 0}
                    style={{ marginLeft: 'auto' }}>전체 삭제</button>
          </div>
          <div className="table-wrap">
            {!posts ? <p className="empty">불러오는 중…</p> : shown.length === 0 ? <p className="empty">글이 없습니다.</p> : (
              <table className="list-table">
                <thead><tr><th>시간</th><th>글쓴이</th><th>내용</th><th className="r">관리</th></tr></thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td className="num muted">{formatTime(p.createdAt)}</td>
                      <td className="title-md" style={{ fontSize: 15 }}>{p.nickname}{p.admin && <span className="caption"> · 관리자</span>}</td>
                      <td className="post-cell">
                        {p.win && <span className="role-badge win" style={{ marginRight: 6 }}>당첨 인증 · {p.win.round}회 {p.win.rank}</span>}
                        {p.content}
                      </td>
                      <td><div className="row-actions"><button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(p)}>삭제</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {msg && <p className="notice">{msg}</p>}
      </div>
    </section>
  )
}
