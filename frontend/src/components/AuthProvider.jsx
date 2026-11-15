import { useEffect, useState } from 'react'
import { AuthContext } from '../auth.js'
import { fetchMe, login, logout } from '../api.js'

const GUEST = { loggedIn: false, admin: false, username: '', nickname: '' }

export default function AuthProvider({ children }) {
  const [me, setMe] = useState(null) // null = 아직 확인 중

  // /api/auth/me 호출은 CSRF 토큰 쿠키도 새로 받아옵니다 (로그인·로그아웃 뒤에 토큰이 바뀜)
  const refresh = () => fetchMe().catch(() => GUEST).then((m) => { setMe(m); return m })
  useEffect(() => { refresh() }, [])

  const signIn = async (username, password) => {
    await login(username, password)
    return refresh() // 로그인한 사용자 정보 반환
  }
  const signOut = async () => {
    try { await logout() } finally { await refresh() }
  }

  return <AuthContext.Provider value={{ me, refresh, signIn, signOut }}>{children}</AuthContext.Provider>
}
