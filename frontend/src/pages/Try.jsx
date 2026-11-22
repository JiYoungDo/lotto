import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth.js'
import NumberMaker from '../components/NumberMaker.jsx'
import { useSeo } from '../useSeo.js'

// 가입 없이 번호 만들어 보기 (/try): 가설 1~9 중 하나를 골라 바로 뽑아 본다. 저장(선점)할 때만 가입이 필요하다.
export default function Try() {
  const { me } = useAuth()
  useSeo('가입 없이 로또 번호 만들어 보기', '가설 1~9 중 하나를 골라 가입 없이 바로 다음 회차 번호를 뽑아 보세요. 마음에 드는 조합은 가입하면 내 이름으로 저장할 수 있습니다. 당첨을 보장하지 않는 오락·학습용 도구입니다.')

  // 이미 로그인한 회원은 저장까지 되는 마이페이지 화면으로
  if (me?.loggedIn) return <Navigate to="/mypage#make" replace />

  return (
    <>
      <section className="section">
        <div className="container legal-doc">
          <div className="section-head">
            <p className="caption">가입 없이 체험</p>
            <h1 className="display-sm">번호 만들어 보기</h1>
            <p>
              가설을 골라 버튼만 누르면 바로 뽑아 볼 수 있어요. 어떤 가설이 무슨 뜻인지 궁금하면 <Link to="/guide/center-numbers">중심 번호 가이드</Link>를,
              가설이 과거에 얼마나 맞았는지는 <Link to="/analysis">가설 분석</Link>을 보세요.
            </p>
          </div>
        </div>
      </section>
      <NumberMaker guest />
    </>
  )
}
