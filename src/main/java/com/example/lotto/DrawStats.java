package com.example.lotto;

import java.util.List;

/**
 * 회차 한 건의 간단한 통계. 회차 화면(JSON)과 검색용 HTML이 같은 계산을 쓴다.
 *
 * @param sum      당첨 번호 6개의 합 (보너스 제외)
 * @param odd      홀수 개수 (짝수는 6 - odd)
 * @param low      1~22(낮은 번호) 개수 (23~45는 6 - low)
 * @param repeated 바로 앞 회차 당첨 번호 중 이번에 다시 나온 번호 (보너스 제외)
 */
public record DrawStats(int sum, int odd, int low, List<Integer> repeated) {

    /** prev 는 바로 앞 회차 (없으면 null) */
    public static DrawStats of(Draw draw, Draw prev) {
        List<Integer> nums = draw.numbers().stream().sorted().toList();
        int sum = nums.stream().mapToInt(Integer::intValue).sum();
        int odd = (int) nums.stream().filter(n -> n % 2 == 1).count();
        int low = (int) nums.stream().filter(n -> n <= 22).count();
        List<Integer> repeated = prev == null
                ? List.of()
                : nums.stream().filter(n -> prev.numbers().contains(n)).toList();
        return new DrawStats(sum, odd, low, repeated);
    }
}
