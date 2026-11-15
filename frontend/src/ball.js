// 로또 공 색 구간: 1~10 → 1, 11~20 → 2, 21~30 → 3, 31~40 → 4, 41~45 → 5
export const ballRange = (n) => Math.min(5, Math.ceil(n / 10))
