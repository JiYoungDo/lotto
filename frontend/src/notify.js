import { createContext, useContext } from 'react'

// 알림 공유: { unread, refreshUnread, setViewing, permission, requestPermission }
export const NotifyContext = createContext({
  unread: 0, refreshUnread: () => {}, setViewing: () => {}, permission: 'unsupported', requestPermission: () => {},
})
export const useNotify = () => useContext(NotifyContext)
