import { useNotify } from '../notify.js'

// 브라우저 알림 켜기 버튼 (이미 허용했거나 지원하지 않으면 상태만 표시)
export default function NotifyToggle() {
  const { permission, requestPermission } = useNotify()
  if (permission === 'unsupported') return null
  if (permission === 'granted') return <span className="caption">🔔 브라우저 알림 켜짐</span>
  if (permission === 'denied') return <span className="caption">브라우저 알림이 차단되어 있어요 (주소창 왼쪽 사이트 설정에서 허용)</span>
  return <button type="button" className="btn btn-secondary btn-sm" onClick={requestPermission}>🔔 브라우저 알림 켜기</button>
}
