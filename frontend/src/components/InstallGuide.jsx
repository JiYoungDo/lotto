import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canPrompt, environment, isStandalone, promptInstall, subscribe } from '../pwa.js'

const KEY = 'lotto:install-card-closed'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

// 홈 화면에 앱처럼 설치하도록 안내하는 카드. 이미 설치해서 연 경우와 닫은 경우에는 보이지 않는다.
export default function InstallGuide() {
  const [, setTick] = useState(0)
  const [closed, setClosed] = useState(read)
  useEffect(() => subscribe(() => setTick((n) => n + 1)), [])

  if (closed || isStandalone()) return null
  const { os, inApp } = environment()
  const close = () => { try { localStorage.setItem(KEY, '1') } catch { /* 저장이 막혀도 이번 방문에서만 닫힘 */ } setClosed(true) }

  let body
  if (inApp) {
    body = <>카카오톡 등 앱 안에서 연 화면에서는 설치할 수 없어요. 오른쪽 아래(또는 위) 메뉴에서 <b>다른 브라우저로 열기</b>를 눌러 {os === 'ios' ? 'Safari' : 'Chrome'}에서 다시 열어 주세요.</>
  } else if (canPrompt()) {
    body = <>버튼 한 번이면 휴대폰 홈 화면에 아이콘이 생겨요. 앱스토어 없이 무료로 설치돼요.</>
  } else if (os === 'ios') {
    body = <>Safari 아래의 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르면 아이콘이 생겨요.</>
  } else if (os === 'android') {
    body = <>Chrome 오른쪽 위 <b>⋮ 메뉴</b> → <b>앱 설치</b>(또는 <b>홈 화면에 추가</b>)를 누르면 아이콘이 생겨요.</>
  } else {
    body = <>주소창 오른쪽의 <b>설치</b> 아이콘을 누르면 앱처럼 따로 열 수 있어요.</>
  }

  return (
    <section className="section install-section" aria-label="앱처럼 설치하기">
      <div className="container">
        <div className="install-card">
          <img src="/icons/icon-192.png" alt="" width="56" height="56" />
          <div className="install-text">
            <div className="title-md">로또 연구소를 앱처럼 쓰세요</div>
            <p className="caption">{body} <Link to="/guide/install-app">자세한 설치 방법</Link></p>
          </div>
          <div className="install-actions">
            {canPrompt() && !inApp && <button className="btn btn-primary btn-sm" type="button" onClick={() => promptInstall()}>앱으로 설치</button>}
            <button className="btn btn-secondary btn-sm" type="button" onClick={close}>닫기</button>
          </div>
        </div>
      </div>
    </section>
  )
}
