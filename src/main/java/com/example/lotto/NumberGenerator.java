package com.example.lotto;

import java.util.*;

/**
 * 가설(케이스)의 조건을 만족하는 번호 6개를 무작위로 뽑는다.
 * 각 케이스의 후보 조합 전체에서 고르게(균등하게) 뽑히도록, 묶음마다 정해진 개수씩 뽑는다.
 *
 *  케이스 0: 무작위 (1~45에서 6개)
 *  케이스 1~9: AnalysisService.SHAPES 의 {직전 회차 번호, 직전 회차를 뺀 가운데 번호, 직전 회차를 뺀 많은 양끝 번호} 개수
 */
public final class NumberGenerator {

    private NumberGenerator() {}

    public static List<Integer> generate(int caseNo, Collection<Integer> center, Collection<Integer> high,
                                         Collection<Integer> prev, Random rnd) {
        return generate(caseNo, center, high, prev, Set.of(), rnd);
    }

    /** removed = 사용자가 뺀 번호. 이 번호들은 어느 묶음에서도 뽑지 않는다. */
    public static List<Integer> generate(int caseNo, Collection<Integer> center, Collection<Integer> high,
                                         Collection<Integer> prev, Collection<Integer> removed, Random rnd) {
        if (caseNo < 0 || caseNo > AnalysisService.CASES) {
            throw new IllegalArgumentException("가설은 0(무작위) 또는 1~" + AnalysisService.CASES + " 입니다.");
        }
        List<Integer> all = new ArrayList<>(), prevPool = new ArrayList<>(), centerPool = new ArrayList<>(), highPool = new ArrayList<>();
        for (int n = 1; n <= 45; n++) {
            if (removed.contains(n)) continue;
            all.add(n);
            if (prev.contains(n)) prevPool.add(n);
            else if (center.contains(n)) centerPool.add(n);
            else if (high.contains(n)) highPool.add(n);
        }
        if (caseNo == 0) return pick(all, 6, rnd).stream().sorted().toList();

        int[] shape = AnalysisService.SHAPES[caseNo - 1];
        List<Integer> out = new ArrayList<>(pick(prevPool, shape[0], rnd));
        out.addAll(pick(centerPool, shape[1], rnd));
        out.addAll(pick(highPool, shape[2], rnd));
        return out.stream().sorted().toList();
    }

    private static List<Integer> pick(List<Integer> pool, int k, Random rnd) {
        if (pool.size() < k) throw new IllegalArgumentException("이 가설을 만족하는 번호가 부족해 만들 수 없습니다. 신뢰구간을 바꿔 보세요.");
        List<Integer> copy = new ArrayList<>(pool);
        Collections.shuffle(copy, rnd);
        return copy.subList(0, k);
    }
}
