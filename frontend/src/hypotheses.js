// 가설(케이스) 1~5 설명. 가설 분석 화면과 마이페이지가 함께 씁니다.

export const CASES = [
  '6개 모두 가운데 번호',
  '케이스 1 + 직전 회차 번호 0개',
  '케이스 1 + 직전 회차 번호 1개',
  '가운데 4개 + 양끝 2개',
  '가운데 5개 + 양끝 1개',
]

// 가설 안내 카드: pips = 6개 번호의 모양 (c 가운데, e 양끝, p 직전 회차에도 나옴, x 직전 회차에 없음)
export const CASE_GUIDE = [
  { title: '6개 모두 가운데', pips: ['c', 'c', 'c', 'c', 'c', 'c'],
    desc: '당첨 번호 6개가 모두 가운데 번호입니다. 직전 회차와 몇 개가 겹치는지는 보지 않습니다.', formula: 'C(k, 6)' },
  { title: '모두 가운데 + 직전 회차 0개', pips: ['c x', 'c x', 'c x', 'c x', 'c x', 'c x'],
    desc: '케이스 1이면서, 직전 회차 번호가 하나도 다시 나오지 않은 경우입니다.', formula: 'C(k − m, 6)' },
  { title: '모두 가운데 + 직전 회차 1개', pips: ['c p', 'c x', 'c x', 'c x', 'c x', 'c x'],
    desc: '케이스 1이면서, 직전 회차 번호가 정확히 1개 다시 나온 경우입니다.', formula: 'm × C(k − m, 5)' },
  { title: '가운데 4개 + 양끝 2개', pips: ['c', 'c', 'c', 'c', 'e', 'e'],
    desc: '가운데 번호가 정확히 4개, 나머지 2개는 양끝 번호입니다.', formula: 'C(k, 4) × C(45 − k, 2)' },
  { title: '가운데 5개 + 양끝 1개', pips: ['c', 'c', 'c', 'c', 'c', 'e'],
    desc: '가운데 번호가 정확히 5개, 나머지 1개는 양끝 번호입니다.', formula: 'C(k, 5) × (45 − k)' },
]

/** 저장한 번호의 출처 이름: null 직접 입력, 0 무작위, 1~5 가설 */
export const sourceLabel = (caseNo) => (caseNo == null ? '직접 입력' : caseNo === 0 ? '무작위' : `가설 ${caseNo}`)
export const summaryLabel = (key) =>
  key === 'manual' ? '직접 입력' : key === 'random' ? '무작위' : `가설 ${key.replace('case', '')}`
