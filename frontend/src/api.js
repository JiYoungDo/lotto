// 서버(Spring Boot)와 통신하는 함수를 한 곳에 모아둡니다.
async function request(url, options) {
  const res = await fetch(url, options)
  let body = null
  try { body = await res.json() } catch { /* 본문이 JSON이 아니면 무시 */ }
  if (!res.ok) throw new Error(body?.message || `요청 실패 (${res.status})`)
  return body
}

export const fetchDraws = (limit = 50) => request(`/api/draws?limit=${limit}`)
export const fetchAnalysis = (conf, min) => request(`/api/analysis?conf=${conf}&min=${min}`)

export const addDraw = (round, numbers) =>
  request('/api/draws', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round, numbers }),
  })

export const uploadExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return request('/api/draws/upload', { method: 'POST', body: form })
}
