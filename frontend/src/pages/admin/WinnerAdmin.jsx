import { useEffect, useRef, useState } from 'react'
import {
  fetchWinnerRounds, fetchWinnerRound, fetchConversations, fetchThread, sendAdminChat, readAdminChat,
} from '../../api.js'
import { useChatEvents } from '../../chat.js'
import { useDrawEvents } from '../../drawEvents.js'
import Balls from '../../components/Balls.jsx'
import ChatThread from '../../components/ChatThread.jsx'
import { sourceLabel } from '../../hypotheses.js'

const RANK_ORDER = ['1등', '5개 일치 (2·3등)', '4등', '5등']

// 관리자 · 당첨자·채팅: 회원들이 저장한 번호 중 당첨(3개 이상 일치)된 회원과 1:1 대화
export default function WinnerAdmin() {
  const [rounds, setRounds] = useState(null)
  const [round, setRound] = useState(null)       // 선택한 회차 번호
  const [detail, setDetail] = useState(null)
  const [convs, setConvs] = useState(null)
  const [openId, setOpenId] = useState(null)     // 대화 중인 회원 id
  const [thread, setThread] = useState(null)
  const [error, setError] = useState(null)
  const chatRef = useRef(null)

  const loadRounds = () => fetchWinnerRounds().then((r) => {
    setRounds(r)
    setRound((cur) => cur ?? (r[0]?.round ?? null))
  }).catch((e) => setError(e.message))
  const loadConvs = () => fetchConversations().then(setConvs).catch((e) => setError(e.message))

  useEffect(() => { loadRounds(); loadConvs() }, [])
  useEffect(() => {
    if (round == null) return
    fetchWinnerRound(round).then(setDetail).catch((e) => setError(e.message))
  }, [round])
  useEffect(() => {
    if (openId == null) return
    fetchThread(openId).then((t) => { setThread(t); loadConvs() }).catch((e) => setError(e.message))
  }, [openId])

  // 당첨 번호가 새로 등록되면 당첨자 다시 계산
  useDrawEvents(() => {
    loadRounds()
    if (round != null) fetchWinnerRound(round).then(setDetail).catch(() => {})
  })

  // 새 메시지: 열린 대화면 바로 붙이고 읽음 처리, 목록·안 읽은 수 갱신
  useChatEvents(true, (m) => {
    if (m && openId === m.memberId) {
      setThread((t) => (t && !t.messages.some((x) => x.id === m.id) ? { ...t, messages: [...t.messages, m] } : t))
      if (!m.fromAdmin) readAdminChat(m.memberId).then(loadConvs).catch(() => {})
      else loadConvs()
    } else {
      loadConvs()
    }
    if (round != null) fetchWinnerRound(round).then(setDetail).catch(() => {})
  })

  const openChat = (memberId) => {
    setOpenId(memberId)
    setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const send = async (content) => {
    const m = await sendAdminChat(openId, content)
    setThread((t) => (t && !t.messages.some((x) => x.id === m.id) ? { ...t, messages: [...t.messages, m] } : t))
    loadConvs()
  }

  const totalUnread = (convs || []).reduce((n, c) => n + c.unread, 0)

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">회차별 당첨자</h2>
            <p>회원들이 마이페이지에 저장한(소진된) 번호를 그 회차 당첨 번호와 비교해 3개 이상 맞은(5등 이상) 회원을 보여줍니다. 보너스 번호는 저장하지 않아 5개 일치는 2·3등을 구분하지 않습니다.</p>
          </div>
          {error && <p className="notice" style={{ marginTop: 0, marginBottom: 16 }}>{error}</p>}

          {!rounds ? <p className="empty">불러오는 중…</p> : rounds.length === 0 ? (
            <div className="feature-card"><p className="empty">아직 추첨된 회차에 저장된 번호가 없습니다.</p></div>
          ) : (
            <div className="winner-layout">
              <div className="round-list" role="listbox" aria-label="회차 선택">
                {rounds.map((r) => (
                  <button key={r.round} type="button" role="option" aria-selected={round === r.round}
                          className={'round-item' + (round === r.round ? ' on' : '')} onClick={() => setRound(r.round)}>
                    <span className="round-item-top">
                      <b>{r.round}회</b>
                      <span className={'result-chip ' + (r.winnerMembers > 0 ? 'win' : 'lose')}>
                        {r.winnerMembers > 0 ? `당첨 ${r.winnerMembers}명` : '당첨자 없음'}
                      </span>
                    </span>
                    <span className="caption">저장 {r.tickets}줄 · {r.members}명 · 당첨 {r.winnerTickets}줄</span>
                  </button>
                ))}
              </div>

              <div className="feature-card">
                {!detail ? <p className="empty">회차를 고르세요.</p> : (
                  <>
                    <div className="result-head">
                      <div className="title-md">{detail.round}회</div>
                      <div className="result-win"><span className="caption">당첨 번호</span><Balls numbers={detail.winning} /></div>
                      <span className="caption" style={{ marginLeft: 'auto' }}>저장된 번호 {detail.totalTickets}줄 중 당첨 {detail.winners.length}줄</span>
                    </div>
                    {(() => {
                      const r = rounds.find((x) => x.round === detail.round)
                      return r && (
                        <div className="rank-chips">
                          {RANK_ORDER.map((k) => <span key={k} className="role-badge">{k} {r.byRank[k] || 0}줄</span>)}
                        </div>
                      )
                    })()}
                    {detail.winners.length === 0 ? <p className="empty">이 회차에는 3개 이상 맞은 번호가 없습니다.</p> : (
                      <div className="table-wrap">
                        <table className="list-table">
                          <thead><tr><th>회원</th><th>번호</th><th>결과</th><th>출처·메모</th><th>저장 시각</th><th className="r">채팅</th></tr></thead>
                          <tbody>
                            {detail.winners.map((w) => (
                              <tr key={w.ticketId} className="row-win">
                                <td className="title-md" style={{ fontSize: 15 }}>{w.username}</td>
                                <td><Balls numbers={w.numbers} dim={w.numbers.filter((n) => !w.matched.includes(n))} /></td>
                                <td><span className="result-chip win">{w.rank} · {w.matchCount}개</span></td>
                                <td className="caption">{sourceLabel(w.caseNo)}{w.memo ? ` · ${w.memo}` : ''}</td>
                                <td className="num muted">{w.savedAt}</td>
                                <td>
                                  <div className="row-actions">
                                    <button className="btn btn-primary btn-sm" type="button" onClick={() => openChat(w.memberId)}>
                                      채팅{w.unread > 0 ? ` (${w.unread})` : ''}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section band-soft" ref={chatRef} id="winner-chat">
        <div className="container">
          <div className="section-head">
            <h2 className="display-sm">당첨자 채팅 {totalUnread > 0 && <span className="result-chip win">안 읽음 {totalUnread}</span>}</h2>
            <p>당첨 기록이 있는 회원만 관리자와 1:1로 대화할 수 있습니다. 회원은 마이페이지에서 대화합니다. 메시지는 실시간으로 오가며, 관리자 누구나 답할 수 있습니다.</p>
          </div>
          <div className="dm-layout">
            <div className="conv-list">
              {!convs ? <p className="empty">불러오는 중…</p> : convs.length === 0 ? (
                <p className="empty">아직 대화가 없습니다. 위 당첨자 목록에서 채팅을 눌러 먼저 말을 걸 수 있어요.</p>
              ) : convs.map((c) => (
                <button key={c.memberId} type="button" className={'conv-item' + (openId === c.memberId ? ' on' : '')}
                        onClick={() => setOpenId(c.memberId)}>
                  <span className="conv-top">
                    <b>{c.username}</b>
                    {c.unread > 0 && <span className="unread-dot">{c.unread}</span>}
                  </span>
                  <span className="conv-last">{c.last.fromAdmin ? '나: ' : ''}{c.last.content}</span>
                </button>
              ))}
            </div>
            <div>
              {!thread || thread.memberId !== openId ? (
                <div className="feature-card"><p className="empty">대화할 회원을 고르세요.</p></div>
              ) : (
                <>
                  <div className="dm-head">
                    <b>{thread.username}</b>
                    <span className="caption">
                      당첨 기록: {thread.wins.length === 0 ? '없음' : thread.wins.map((w) => `${w.round}회 ${w.rank}`).join(', ')}
                    </span>
                  </div>
                  <ChatThread messages={thread.messages} viewerIsAdmin onSend={send}
                              emptyText="아직 대화가 없습니다. 당첨 축하와 안내 메시지를 먼저 보내 보세요." />
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
