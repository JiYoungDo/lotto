import { useEffect, useState } from 'react'
import { fetchPosts } from './api.js'

/**
 * 커뮤니티 글 목록 + 실시간 연결(SSE).
 * 새 글·삭제·정리 이벤트를 받으면 목록을 바로 고칩니다. 연결이 끊기면 브라우저가 자동으로 다시 연결하고,
 * 다시 연결될 때마다 전체 목록을 새로 받아 빠진 글이 없게 합니다.
 */
export function useCommunity() {
  const [posts, setPosts] = useState(null)
  const [meta, setMeta] = useState({ max: 100, maxLength: 500 })
  const [online, setOnline] = useState(0)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    const sync = () =>
      fetchPosts()
        .then((d) => {
          if (!alive) return
          setPosts(d.posts)
          setMeta({ max: d.max, maxLength: d.maxLength })
          setOnline(d.online)
          setError(null)
        })
        .catch((e) => alive && setError(e.message))

    const es = new EventSource('/api/community/stream')
    const on = (name, fn) => es.addEventListener(name, (ev) => fn(JSON.parse(ev.data)))
    es.onopen = () => { setConnected(true); sync() }
    es.onerror = () => setConnected(false)
    on('post', (p) => setPosts((list) => {
      if (!list || list.some((x) => x.id === p.id)) return list
      return [...list, p].slice(-100)
    }))
    on('delete', ({ id }) => setPosts((list) => list && list.filter((x) => x.id !== id)))
    on('pruned', ({ minId }) => setPosts((list) => list && list.filter((x) => x.id >= minId)))
    on('clear', () => setPosts([]))
    on('presence', ({ online: n }) => setOnline(n))

    return () => { alive = false; es.close() }
  }, [])

  // 내가 쓴 글은 서버 응답으로 바로 추가 (실시간 이벤트와 중복되면 무시)
  const addLocal = (p) => setPosts((list) => (list && !list.some((x) => x.id === p.id) ? [...list, p].slice(-100) : list))
  const removeLocal = (id) => setPosts((list) => list && list.filter((x) => x.id !== id))

  return { posts, meta, online, connected, error, addLocal, removeLocal }
}

/** 글 시간 표시: 오늘이면 HH:mm, 아니면 MM-DD HH:mm */
export function formatTime(iso) {
  const [date, time] = iso.split('T')
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return date === today ? time.slice(0, 5) : `${date.slice(5)} ${time.slice(0, 5)}`
}
