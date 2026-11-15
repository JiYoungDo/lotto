/**
 * 실시간 연결(SSE) 공유.
 * 같은 주소는 화면 여러 곳에서 구독해도 연결을 하나만 엽니다 (브라우저의 동시 연결 수 제한 때문).
 * 마지막 구독이 끝나면 연결을 닫습니다.
 * listener(name, data): 이벤트 이름과 데이터. 연결이 끊겼다 다시 이어지면 ('reconnect', null).
 */
const streams = new Map()

export function subscribeStream(url, names, listener) {
  let s = streams.get(url)
  if (!s) {
    const es = new EventSource(url)
    s = { es, listeners: new Set(), names: new Set(), opened: false }
    const st = s
    es.onopen = () => {
      if (st.opened) st.listeners.forEach((l) => l('reconnect', null))
      st.opened = true
    }
    streams.set(url, s)
  }
  const st = s
  for (const n of names) {
    if (st.names.has(n)) continue
    st.names.add(n)
    st.es.addEventListener(n, (ev) => {
      const data = JSON.parse(ev.data)
      st.listeners.forEach((l) => l(n, data))
    })
  }
  st.listeners.add(listener)
  return () => {
    st.listeners.delete(listener)
    if (st.listeners.size === 0) {
      st.es.close()
      streams.delete(url)
    }
  }
}
