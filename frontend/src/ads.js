// Google AdSense 설정. 값은 frontend/.env.local 에 적습니다 (.env.example 참고).
// 게시자 ID가 비어 있으면 광고 스크립트를 불러오지 않고 광고 칸도 그리지 않습니다.
export const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || ''   // 예: ca-pub-1234567890123456
export const AD_SLOTS = {
  inline: import.meta.env.VITE_ADSENSE_SLOT_INLINE || '',   // 본문 사이 (회차 번호, 가설 분석)
  bottom: import.meta.env.VITE_ADSENSE_SLOT_BOTTOM || '',   // 푸터 위 (가설 분석, 커뮤니티)
}
export const ADS_ENABLED = /^ca-pub-\d+$/.test(ADSENSE_CLIENT)

let loaded = false
/** adsbygoogle.js 를 한 번만 불러옴 */
export function loadAdScript() {
  if (loaded || !ADS_ENABLED) return
  loaded = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}
