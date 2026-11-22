// 홈 화면 설치(PWA) 도우미.
// 안드로이드·PC 크롬은 설치 가능해지면 beforeinstallprompt 를 한 번 보낸다. 화면이 뜨기 전에 올 수 있어서 main.jsx 에서 일찍 불러 붙잡아 둔다.
let deferred = null
const subs = new Set()
const notify = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()   // 브라우저 기본 안내 대신 사이트의 설치 버튼을 쓴다
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}

export const subscribe = (f) => { subs.add(f); return () => subs.delete(f) }
export const canPrompt = () => deferred != null

export async function promptInstall() {
  if (!deferred) return false
  deferred.prompt()
  const choice = await deferred.userChoice
  deferred = null
  notify()
  return choice.outcome === 'accepted'
}

// 이미 홈 화면 앱으로 열었는지
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// 'ios' | 'android' | 'other', 카카오톡 같은 앱 안 브라우저인지
export function environment() {
  const ua = navigator.userAgent || ''
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const android = /Android/i.test(ua)
  return {
    os: ios ? 'ios' : android ? 'android' : 'other',
    inApp: /KAKAOTALK|NAVER\(inapp|FBAN|FBAV|Instagram|Line\//i.test(ua),   // 앱 안 브라우저에서는 홈 화면 추가가 안 되는 경우가 많다
  }
}
