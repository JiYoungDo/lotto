import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// AdSense 게시자 ID가 있으면: 사이트 확인용 meta 태그를 넣고, 빌드 결과에 ads.txt 를 만든다
function adsense(client) {
  const ok = /^ca-pub-\d+$/.test(client || '')
  return {
    name: 'adsense',
    transformIndexHtml: () => (ok ? [{ tag: 'meta', attrs: { name: 'google-adsense-account', content: client }, injectTo: 'head' }] : []),
    generateBundle() {
      if (!ok) return
      const pub = client.replace(/^ca-/, '')
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` })
    },
  }
}

// 개발 중: React(5173) → /api 요청을 Spring Boot(8080)로 전달
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), adsense(env.VITE_ADSENSE_CLIENT)],
    server: {
      proxy: {
        '/api': 'http://localhost:8080',
        '/h2-console': 'http://localhost:8080', // DB 웹 화면 (관리자 전용)
      },
    },
  }
})
