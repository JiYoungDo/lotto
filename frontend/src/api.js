// 서버(Spring Boot)와 통신하는 함수를 한 곳에 모아둡니다.

// 서버가 내려준 CSRF 토큰 쿠키. 등록·업로드 같은 변경 요청에 헤더로 함께 보내야 합니다.
const csrfToken = () => {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function request(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { ...options.headers }
  if (method !== 'GET' && csrfToken()) headers['X-XSRF-TOKEN'] = csrfToken()
  const res = await fetch(url, { ...options, headers, credentials: 'same-origin' })
  let body = null
  try { body = await res.json() } catch { /* 본문이 JSON이 아니면 무시 */ }
  if (!res.ok) {
    const err = new Error(body?.message || `요청 실패 (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

export const fetchDraws = (limit = 50) => request(`/api/draws?limit=${limit}`)
export const fetchDraw = (round) => request(`/api/draws/${round}`)
export const fetchPool = (conf = 60) => request(`/api/draws/pool?conf=${conf}`)
export const fetchAnalysis = (conf, min) => request(`/api/analysis?conf=${conf}&min=${min}`)

export const addDraw = (round, numbers, bonus, date) =>
  request('/api/draws', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round, numbers, bonus, date: date || null }), // date 'yyyy-MM-dd', 비우면 서버가 계산
  })

export const uploadExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return request('/api/draws/upload', { method: 'POST', body: form })
}

export const deleteDraw = (round) => request(`/api/draws/${round}`, { method: 'DELETE' })

// 로그인
export const fetchMe = () => request('/api/auth/me')
export const login = (username, password) =>
  request('/api/auth/login', { method: 'POST', body: new URLSearchParams({ username, password }) })
export const logout = () => request('/api/auth/logout', { method: 'POST' })
export const signUp = (username, nickname, password, adult, agreeTerms, agreePrivacy) =>
  request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, nickname, password, adult, agreeTerms, agreePrivacy }),
  })
// 가입 전에 아이디·닉네임을 쓸 수 있는지 확인: { username?: { ok, message }, nickname?: { ok, message } }
export const checkAvailable = (field, value) => request(`/api/auth/available?${field}=${encodeURIComponent(value)}`)
// 기존 회원이 지금 약관에 다시 동의
export const agreeTerms = () => request('/api/auth/agree', json('POST', { agreeTerms: true, agreePrivacy: true }))
// 회원 탈퇴: 비밀번호 확인, deletePosts면 내 커뮤니티 글도 삭제
export const withdraw = (password, deletePosts) => request('/api/auth/withdraw', json('POST', { password, deletePosts }))
export const changeNickname = (nickname) => request('/api/auth/nickname', json('PATCH', { nickname }))
export const changePassword = (currentPassword, newPassword) =>
  request('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

// 관리자: 회원 관리
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const fetchMembers = () => request('/api/admin/members')
export const fetchMemberStats = () => request('/api/admin/members/stats')
export const setMemberRole = (id, role) => request(`/api/admin/members/${id}/role`, json('PATCH', { role }))
export const setMemberSuspended = (id, suspended) => request(`/api/admin/members/${id}/suspend`, json('PATCH', { suspended }))
export const resetMemberPassword = (id) => request(`/api/admin/members/${id}/reset-password`, { method: 'POST' })
export const deleteMember = (id) => request(`/api/admin/members/${id}`, { method: 'DELETE' })

// 커뮤니티
export const fetchPosts = () => request('/api/community/posts')
export const writePost = (content, ticketId = null) => request('/api/community/posts', json('POST', { content, ticketId }))
export const fetchMyWins = () => request('/api/my/wins')
export const deletePost = (id) => request(`/api/community/posts/${id}`, { method: 'DELETE' })
export const fetchCommunityStats = () => request('/api/admin/community')
export const clearPosts = () => request('/api/admin/community/posts', { method: 'DELETE' })

// 마이페이지
const excludeParam = (removed) => (removed && removed.length ? `&exclude=${removed.join(',')}` : '')
// guest 이면 가입 없이 쓰는 주소(/api/try, 저장 불가), 아니면 회원용 주소(/api/my)
const genBase = (guest) => (guest ? '/api/try' : '/api/my')
export const generateNumbers = (caseNo, count, conf, removed, guest = false) =>
  request(`${genBase(guest)}/generate?caseNo=${caseNo}&count=${count}&conf=${conf}${excludeParam(removed)}`)
export const fetchGenerateOptions = (caseNo, conf, removed, guest = false) =>
  request(`${genBase(guest)}/generate/options?caseNo=${caseNo}&conf=${conf}${excludeParam(removed)}`)
export const fetchMyTickets = () => request('/api/my/tickets')
export const fetchMyRewards = () => request('/api/my/rewards')
export const attendToday = () => request('/api/my/rewards/attend', { method: 'POST' })
export const saveTickets = (body) => request('/api/my/tickets', json('POST', body))
export const updateTicketMemo = (id, memo) => request(`/api/my/tickets/${id}`, json('PATCH', { memo }))
export const deleteTicket = (id) => request(`/api/my/tickets/${id}`, { method: 'DELETE' })

// 당첨 회원 ↔ 관리자 채팅
export const fetchMyChat = () => request('/api/chat/me')
export const fetchChatUnread = () => request('/api/chat/unread')
export const sendMyChat = (content) => request('/api/chat/me', json('POST', { content }))
export const readMyChat = () => request('/api/chat/me/read', { method: 'POST' })
export const fetchWinnerRounds = () => request('/api/admin/winners')
export const fetchWinnerRound = (round) => request(`/api/admin/winners/${round}`)
export const fetchConversations = () => request('/api/admin/chats')
export const fetchThread = (memberId) => request(`/api/admin/chats/${memberId}`)
export const sendAdminChat = (memberId, content) => request(`/api/admin/chats/${memberId}`, json('POST', { content }))
export const readAdminChat = (memberId) => request(`/api/admin/chats/${memberId}/read`, { method: 'POST' })


// 미니 게임 (game: 'runner' 공 점프 러너, 'catch' 번호 캐치)
export const fetchGameRanking = (game) => request(`/api/game/${game}/ranking`)
export const fetchMyGame = (game) => request(`/api/game/${game}/me`)
export const startGameRun = (game) => request(`/api/game/${game}/runs`, { method: 'POST' })
export const submitGameScore = (game, runId, score) => request(`/api/game/${game}/scores`, json('POST', { runId, score }))
