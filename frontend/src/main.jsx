import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './app.css'
import './pwa.js'
import App from './App.jsx'
import AuthProvider from './components/AuthProvider.jsx'
import NotificationProvider from './components/NotificationProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// 홈 화면 설치(PWA)용 서비스 워커. 운영 빌드에서만 등록한다 (개발 중 캐시가 헷갈리지 않게).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
