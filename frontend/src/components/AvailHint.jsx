// 입력칸 아래 안내: 형식 규칙 → 중복 확인 결과(사용 가능/사용 중)
export default function AvailHint({ input, formatOk, free, rule, okText }) {
  if (input && formatOk && free) {
    return <p className={'field-hint ' + (free.ok ? 'good' : 'bad')}>{free.ok ? okText : free.message}</p>
  }
  return <p className={'field-hint' + (input && !formatOk ? ' bad' : '')}>{rule}</p>
}
