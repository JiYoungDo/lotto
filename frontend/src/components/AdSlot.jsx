import { useEffect, useRef } from 'react'
import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS, loadAdScript } from '../ads.js'

// 광고 칸. 게임·입력 폼 가까이에는 두지 않습니다 (잘못 누르는 클릭은 AdSense 정책 위반).
// 광고가 꺼져 있으면 개발 중에만 자리 표시를 보여 주고, 배포 화면에는 아무것도 그리지 않습니다.
export default function AdSlot({ type = 'inline' }) {
  const ref = useRef(null)
  const slot = AD_SLOTS[type]
  const on = ADS_ENABLED && !!slot

  useEffect(() => {
    if (!on) return
    loadAdScript()
    const el = ref.current
    if (!el || el.getAttribute('data-adsbygoogle-status')) return   // 이미 채운 칸 (개발 모드의 두 번 실행 방지)
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* 광고 차단 등 */ }
  }, [on])

  if (!on) {
    if (!import.meta.env.DEV) return null
    return (
      <div className="ad-band">
        <div className="container"><div className="ad-placeholder">광고 자리 ({type})</div></div>
      </div>
    )
  }
  return (
    <div className="ad-band">
      <div className="container">
        <span className="ad-label">광고</span>
        <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }}
             data-ad-client={ADSENSE_CLIENT} data-ad-slot={slot}
             data-ad-format="auto" data-full-width-responsive="true" />
      </div>
    </div>
  )
}
