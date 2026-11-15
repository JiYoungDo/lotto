// 면책·이용 제한 안내. 푸터, 회원가입, 번호 기록(마이페이지) 화면에서 같은 문구를 씁니다.
const DISCLAIMER = [
  { key: 'no-guarantee', title: '당첨 보장 아님', text: '이 서비스의 분석과 번호는 당첨을 보장하거나 확률을 높이지 않습니다. 오락·학습 용도로만 쓰세요.' },
  { key: 'adult', title: '미성년자 이용 불가', text: '만 19세 미만은 이용할 수 없습니다.' },
  { key: 'help', title: '도박 문제 상담 1336', text: '도박 문제로 어려움이 있다면 한국도박문제예방치유원 1336으로 상담하세요 (24시간 무료).' },
]

/** compact: 푸터처럼 한 줄로, 기본: 세 항목을 나눠 보여 주는 안내 상자 */
export default function Disclaimer({ compact = false }) {
  if (compact) {
    return (
      <p className="disclaimer-line">
        당첨을 보장하거나 확률을 높이지 않으며 오락·학습 용도입니다. 만 19세 미만 미성년자는 이용할 수 없습니다.
        도박 문제 상담은 <a href="tel:1336">1336</a> (24시간 무료).
      </p>
    )
  }
  return (
    <aside className="disclaimer" role="note" aria-label="이용 안내">
      {DISCLAIMER.map((d) => (
        <div key={d.key} className="disclaimer-item">
          <b>{d.key === 'help' ? <>도박 문제 상담 <a href="tel:1336">1336</a></> : d.title}</b>
          <span>{d.text}</span>
        </div>
      ))}
    </aside>
  )
}
