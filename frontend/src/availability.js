import { useEffect, useState } from 'react'
import { checkAvailable } from './api.js'

// 닉네임 형식: 한글·영문·숫자·밑줄 2~12자 (서버 MemberService.NICKNAME 과 같게)
export const NICKNAME_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/

/**
 * 아이디·닉네임 중복 확인: 입력을 멈추고 0.4초 뒤 서버에 물어봄.
 * 결과: null(확인 전·형식 오류) | { value, ok, message }
 */
export function useAvailability(field, value, formatOk) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!formatOk) return
    let alive = true
    const t = setTimeout(() => {
      checkAvailable(field, value)
        .then((d) => alive && setResult({ value, ...d[field] }))
        .catch(() => {})
    }, 400)
    return () => { alive = false; clearTimeout(t) }
  }, [field, value, formatOk])
  return formatOk && result?.value === value ? result : null
}

