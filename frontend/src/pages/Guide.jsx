import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import AdSlot from '../components/AdSlot.jsx'
import { GUIDES } from '../guides.jsx'

// 화면마다 탭 제목과 검색 결과 설명(meta description)을 바꿉니다.
function useSeo(title, description) {
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

export function GuideIndex() {
  useSeo('가이드', '로또 연구소 사용법, 중심 번호 가설, 당첨 확률, 가설 검증 방법을 정리한 가이드 글 모음입니다.')
  return (
    <section className="section">
      <div className="container legal-doc">
        <div className="section-head">
          <h1 className="display-sm">가이드</h1>
          <p>로또 연구소를 쓰는 방법과, 숫자를 올바르게 읽는 방법을 정리했습니다. 모든 글은 오락·학습 용도이며 당첨을 보장하지 않습니다.</p>
        </div>
        <ul className="guide-list">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link className="guide-title" to={`/guide/${g.slug}`}>{g.title}</Link>
              <p>{g.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function GuideArticle() {
  const { slug } = useParams()
  const guide = GUIDES.find((g) => g.slug === slug)
  useSeo(guide?.title, guide?.summary)
  if (!guide) return <Navigate to="/guide" replace />
  return (
    <>
      <section className="section">
        <div className="container legal-doc">
          <div className="section-head">
            <p className="caption"><Link to="/guide">← 가이드 목록</Link></p>
            <h1 className="display-sm">{guide.title}</h1>
            <p className="caption">최종 수정 {guide.updated}</p>
          </div>
          <article>{guide.body}</article>
          <p className="caption legal-foot">이 글은 오락·학습 목적의 일반적인 설명이며, 당첨을 보장하거나 확률을 높이지 않습니다. 만 19세 미만은 이용할 수 없습니다.</p>
        </div>
      </section>
      <AdSlot key={slug} type="inline" />
    </>
  )
}
