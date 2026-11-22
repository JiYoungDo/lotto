import { useEffect } from 'react'

// 화면마다 탭 제목과 검색 결과 설명(meta description)을 바꿉니다. 화면을 떠나면 원래대로 돌려 놓습니다.
export function useSeo(title, description) {
  useEffect(() => {
    if (!title) return
    const prevTitle = document.title
    document.title = `${title} · 로또 연구소`
    let meta = document.querySelector('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const prevDesc = meta.getAttribute('content')
    meta.setAttribute('content', description || '')
    return () => {
      document.title = prevTitle
      if (created) meta.remove()
      else if (prevDesc != null) meta.setAttribute('content', prevDesc)
    }
  }, [title, description])
}
