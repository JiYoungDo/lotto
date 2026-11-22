// 로또 연구소 서비스 워커 (홈 화면 설치용)
// - 화면 내용은 캐시하지 않는다: 당첨 번호·회원 정보는 항상 서버에서 최신으로 가져온다.
// - 하는 일은 두 가지뿐: (1) 인터넷이 끊겼을 때 안내 화면을 보여 주고, (2) 해시가 붙은 정적 파일(/assets/)을 캐시해 두 번째 열기부터 빠르게 한다.
// - /api/ 요청(로그인, 실시간 알림 포함)은 건드리지 않는다.
const VERSION = 'v1'
const SHELL_CACHE = `lotto-shell-${VERSION}`
const ASSET_CACHE = `lotto-assets-${VERSION}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/h2-console')) return

  // 페이지 이동: 항상 서버에서. 실패(오프라인)하면 안내 화면
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // 빌드할 때 이름이 바뀌는 정적 파일: 캐시에 있으면 그대로, 없으면 받아서 저장
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone())
          return res
        })),
      ),
    )
  }
})
