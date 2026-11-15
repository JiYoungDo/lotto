import { createContext, useContext } from 'react'

// 로그인 상태 공유: { me: { loggedIn, admin, username } | null(확인 중), refresh, signIn, signOut }
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
