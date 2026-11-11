import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 개발 중: React(5173) → /api 요청을 Spring Boot(8080)로 전달
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8080' },
  },
})
